"""Let `requests` trust the same HTTPS certificates as Windows.

`requests` verifies HTTPS with its own certificate list (certifi). Antivirus
HTTPS scanning (e.g. Norton Web/Mail Shield, Avast, Kaspersky) and some company
networks re-sign traffic with a root certificate that only Windows knows, so
every call to NASA's servers fails with CERTIFICATE_VERIFY_FAILED. On Windows we
write certifi's list plus the Windows trusted roots into one bundle and point
`requests` at it. Verification stays ON; this adds trust, it never removes it.
Standard library only. Does nothing on other systems or when REQUESTS_CA_BUNDLE
is already set.
"""
from __future__ import annotations

import os
import ssl
import sys
import tempfile
from pathlib import Path

SERVER_AUTH = "1.3.6.1.5.5.7.3.1"


def use_system_certificates() -> str | None:
    if sys.platform != "win32" or os.environ.get("REQUESTS_CA_BUNDLE"):
        return None
    try:
        import certifi
        pems = [Path(certifi.where()).read_text(encoding="ascii", errors="ignore")]
        for store in ("ROOT", "CA"):
            for der, enc, trust in ssl.enum_certificates(store):
                if enc == "x509_asn" and (trust is True or SERVER_AUTH in trust):
                    pems.append(ssl.DER_cert_to_PEM_cert(der))
        path = Path(tempfile.gettempdir()) / "delta_pulse_ca_bundle.pem"
        path.write_text("\n".join(pems), encoding="ascii")
        os.environ["REQUESTS_CA_BUNDLE"] = str(path)
        return str(path)
    except Exception:  # noqa: BLE001  (never block startup; requests falls back to certifi)
        return None
