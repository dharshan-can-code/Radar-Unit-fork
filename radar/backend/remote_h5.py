"""Read parts of a NISAR HDF5 file over HTTPS without downloading it.

ASF serves files behind Earthdata Login; an authenticated request is
redirected to a short-lived pre-signed URL. We resolve that URL once and
then issue HTTP Range requests for only the bytes h5py asks for, through a
small block cache. GCOV files are chunked (512x512) with paged metadata, so a
~20 km window needs a few MB instead of the whole 1.8 GB file.
"""
from __future__ import annotations

import io
import threading
import time
from collections import OrderedDict

import requests


class RemoteFile(io.RawIOBase):
    def __init__(self, url: str, token: str, block_size: int = 1024 * 1024, max_blocks: int = 128):
        super().__init__()
        self.session = requests.Session()
        self.token = token
        self.block_size = block_size
        self.max_blocks = max_blocks
        self.blocks: OrderedDict[int, bytes] = OrderedDict()
        self.lock = threading.Lock()
        self.pos = 0
        self.bytes_fetched = 0
        self.n_requests = 0
        self.orig_url = url
        self._resolve()

    def _resolve(self):
        r = self.session.get(self.orig_url, headers={"Authorization": f"Bearer {self.token}", "Range": "bytes=0-0"},
                             allow_redirects=True, timeout=60)
        if r.status_code not in (200, 206):
            raise PermissionError(f"ASF returned HTTP {r.status_code} for {self.orig_url.rsplit('/', 1)[-1]}")
        self.url = r.url  # pre-signed URL after redirects
        cr = r.headers.get("Content-Range", "")
        self.size = int(cr.split("/")[-1]) if "/" in cr else int(r.headers["Content-Length"])
        self.resolved_at = time.time()

    def _get_block(self, i: int) -> bytes:
        with self.lock:
            if i in self.blocks:
                self.blocks.move_to_end(i)
                return self.blocks[i]
        start = i * self.block_size
        end = min(start + self.block_size, self.size) - 1
        for attempt in range(3):
            if time.time() - self.resolved_at > 1800:  # pre-signed URLs expire; refresh early
                self._resolve()
            r = self.session.get(self.url, headers={"Range": f"bytes={start}-{end}"}, timeout=120)
            if r.status_code == 206:
                break
            if r.status_code in (401, 403):
                self._resolve()
                continue
            r.raise_for_status()
        else:
            raise IOError(f"range request failed ({r.status_code})")
        data = r.content
        with self.lock:
            self.bytes_fetched += len(data)
            self.n_requests += 1
            self.blocks[i] = data
            if len(self.blocks) > self.max_blocks:
                self.blocks.popitem(last=False)
        return data

    def prefetch(self, ranges: list[tuple[int, int]], workers: int = 16):
        """Fetch every block covering the given (offset, size) byte ranges in
        parallel, so the following h5py reads are served from memory instead of
        one HTTP round trip at a time."""
        need = sorted({i for off, size in ranges if size > 0
                       for i in range(off // self.block_size, (off + size - 1) // self.block_size + 1)})
        with self.lock:
            need = [i for i in need if i not in self.blocks]
            self.max_blocks = max(self.max_blocks, len(self.blocks) + len(need) + 16)
        if not need:
            return 0
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=min(workers, len(need))) as ex:
            list(ex.map(self._get_block, need))
        return len(need)

    # --- io.RawIOBase API used by h5py ---
    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=io.SEEK_SET):
        if whence == io.SEEK_SET:
            self.pos = offset
        elif whence == io.SEEK_CUR:
            self.pos += offset
        else:
            self.pos = self.size + offset
        return self.pos

    def readinto(self, b):
        n = len(b)
        if self.pos >= self.size or n == 0:
            return 0
        n = min(n, self.size - self.pos)
        out = memoryview(b)
        done = 0
        while done < n:
            i, off = divmod(self.pos + done, self.block_size)
            blk = self._get_block(i)
            take = min(n - done, len(blk) - off)
            out[done:done + take] = blk[off:off + take]
            done += take
        self.pos += n
        return n
