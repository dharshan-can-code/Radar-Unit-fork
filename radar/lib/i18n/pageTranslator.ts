// Translates the page content in place, in any browser.
// Engines: Microsoft Azure Translator through the site's own /api/translate route (every browser), or,
// where that is not set up, the browser's built-in on-device Translator API (Chrome 138+, Edge 148+).
// Text nodes are changed in place (never replaced), so React keeps working; anything React or the
// app adds or changes later is translated as it appears, and stop() puts the English back.
//
// Speed: text on screen goes first and the order follows the reader as they scroll; many strings go in
// one request; and every translation is remembered in this browser, so a page seen before switches at once.
import type { LanguageCode } from "@/lib/i18n/translations";

/** Something that translates a batch of English strings into one language, in order. */
export interface Engine {
  name: string;
  batchSize: number;   // strings per call
  parallel: number;    // calls at once
  translate(texts: string[]): Promise<string[]>;
  destroy?(): void;
}

// ---- engine 1: Azure Translator via /api/translate ------------------------------------------

export class TranslateError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Whether the site's server has Azure Translator set up (answers fast either way). */
export async function serverTranslation(): Promise<boolean> {
  try {
    const r = await fetch("/api/translate", { signal: AbortSignal.timeout(5000), cache: "no-store" });
    return r.ok && ((await r.json()) as { configured?: boolean }).configured === true;
  } catch { return false; }
}

export function azureEngine(lang: LanguageCode): Engine {
  return {
    name: "Microsoft Translator",
    batchSize: 80,
    parallel: 2,
    async translate(texts) {
      const r = await fetch("/api/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: lang, texts }), signal: AbortSignal.timeout(20_000),
      });
      const j = (await r.json().catch(() => ({}))) as { translations?: string[]; error?: string };
      if (!r.ok || !j.translations) throw new TranslateError(j.error ?? `Translation failed (${r.status}).`, r.status);
      return j.translations;
    },
  };
}

// ---- engine 2: the browser's on-device Translator API ----------------------------------------

export interface TranslatorLike { translate(text: string): Promise<string>; destroy?(): void }
interface Opts { sourceLanguage: string; targetLanguage: string }
export interface TranslatorApi {
  availability(o: Opts): Promise<string>;
  create(o: Opts & { monitor?: (m: EventTarget) => void }): Promise<TranslatorLike>;
}

export const translatorApi = (): TranslatorApi | null =>
  ((globalThis as unknown as { Translator?: TranslatorApi }).Translator) ?? null;

/** The on-device translator's code for a site language (Chinese scripts are named differently). */
export const engineCode = (c: LanguageCode) => (c === "zh-CN" ? "zh" : c === "zh-TW" ? "zh-Hant" : c);

export function deviceEngine(tr: TranslatorLike): Engine {
  return {
    name: "your browser",
    batchSize: 1,
    parallel: 4,
    translate: async (texts) => Promise.all(texts.map((t) => tr.translate(t))),
    destroy: () => tr.destroy?.(),
  };
}

// ---- the page walker ------------------------------------------------------------------------

const SKIP = 'script,style,noscript,code,pre,textarea,select,[translate="no"],.notranslate';
const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const LETTER = /\p{L}/u;
/** One-word file names, scene IDs and codes ("NISAR_L2_PR_GCOV_023…", "P05036", "t83A_f8"): left as they are. */
const IDENTIFIER = /^\s*\S*[_\d]\S*\s*$/u;
const translatable = (s: string) => LETTER.test(s) && !IDENTIFIER.test(s);
const BATCH_CHARS = 15_000;
const STORE_VERSION = 1;
const STORE_MAX = 4000; // strings remembered per language

/** Translations remembered in this browser, one store per language. */
class Memory {
  private key: string;
  private map = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(lang: string) {
    this.key = `dp-translations-v${STORE_VERSION}-${lang}`;
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) this.map = new Map(Object.entries(JSON.parse(raw) as Record<string, string>));
    } catch { /* storage blocked or corrupt: start empty */ }
  }
  get(s: string) { return this.map.get(s); }
  set(s: string, v: string) {
    this.map.delete(s);
    this.map.set(s, v); // newest last, so trimming drops the oldest
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 1500);
  }
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    while (this.map.size > STORE_MAX) this.map.delete(this.map.keys().next().value!);
    try { localStorage.setItem(this.key, JSON.stringify(Object.fromEntries(this.map))); }
    catch { /* full or blocked: keep the in-memory copy only */ }
  }
}

interface Job { s: string; els: Set<Element>; resolve: (v: string) => void; reject: (e: unknown) => void }

export class PageTranslator {
  private orig = new WeakMap<Text, string>();
  private mine = new WeakMap<Text, string>();
  private texts = new Set<Text>();
  private attrOrig = new WeakMap<Element, Map<string, string>>();
  private attrMine = new WeakMap<Element, Map<string, string>>();
  private els = new Set<Element>();
  private inflight = new Map<string, Promise<string>>();
  private jobs = new Map<string, Job>(); // waiting, by string
  private memory: Memory;
  private running = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private obs: MutationObserver | null = null;
  private stopped = false;

  constructor(private root: HTMLElement, private engine: Engine, lang: string,
    private onPending: (n: number) => void, private onError: (e: unknown) => void = () => {}) {
    this.memory = new Memory(lang);
  }

  start() {
    this.walk(this.root);
    this.obs = new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") this.text(m.target as Text);
        else if (m.type === "attributes") this.attr(m.target as Element, m.attributeName!);
        else m.addedNodes.forEach((n) => this.walk(n));
      }
    });
    this.obs.observe(this.root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
  }

  /** Stop watching and put back the English wherever the text is still our translation. */
  stop() {
    this.stopped = true;
    this.obs?.disconnect();
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.memory.flush();
    this.jobs.clear();
    this.onPending(0);
    for (const t of this.texts) if (t.data === this.mine.get(t)) t.data = this.orig.get(t)!;
    for (const el of this.els) {
      const o = this.attrOrig.get(el), mine = this.attrMine.get(el);
      o?.forEach((v, k) => { if (el.getAttribute(k) === mine?.get(k)) el.setAttribute(k, v); });
    }
    this.texts.clear(); this.els.clear();
  }

  private skip(el: Element | null) { return !el || !!el.closest(SKIP); }

  private walk(n: Node) {
    if (n.nodeType === Node.TEXT_NODE) { this.text(n as Text); return; }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as Element;
    if (this.skip(el)) return;
    for (const a of ATTRS) if (el.hasAttribute(a)) this.attr(el, a);
    el.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach((x) => { if (!this.skip(x)) ATTRS.forEach((a) => x.hasAttribute(a) && this.attr(x, a)); });
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = w.nextNode(); t; t = w.nextNode()) this.text(t as Text);
  }

  private text(t: Text) {
    const src = t.data;
    if (src === this.mine.get(t) || !translatable(src) || this.skip(t.parentElement)) return;
    this.orig.set(t, src);
    this.texts.add(t);
    const lead = src.match(/^\s*/)![0], trail = src.match(/\s*$/)![0];
    const put = (out: string) => {
      if (this.stopped || t.data !== src) return; // changed meanwhile: its own mutation handles it
      const v = lead + out + trail;
      this.mine.set(t, v);
      t.data = v;
    };
    const known = this.memory.get(src.trim());
    if (known != null) { put(known); return; } // remembered: no request, no wait
    this.get(src.trim(), t.parentElement!).then(put, () => {});
  }

  private attr(el: Element, name: string) {
    const src = el.getAttribute(name);
    if (src == null || src === this.attrMine.get(el)?.get(name) || !translatable(src)) return;
    if (!this.attrOrig.has(el)) { this.attrOrig.set(el, new Map()); this.attrMine.set(el, new Map()); }
    this.attrOrig.get(el)!.set(name, src);
    this.els.add(el);
    const put = (out: string) => {
      if (this.stopped || el.getAttribute(name) !== src) return;
      this.attrMine.get(el)!.set(name, out);
      el.setAttribute(name, out);
    };
    const known = this.memory.get(src.trim());
    if (known != null) { put(known); return; }
    this.get(src.trim(), el).then(put, () => {});
  }

  /** One translation per distinct string, gathered into batches a moment later. */
  private get(s: string, where: Element): Promise<string> {
    const job = this.jobs.get(s);
    if (job) { job.els.add(where); return this.inflight.get(s)!; }
    const p = this.inflight.get(s);
    if (p) return p;
    const np = new Promise<string>((resolve, reject) => this.jobs.set(s, { s, els: new Set([where]), resolve, reject }));
    this.inflight.set(s, np);
    np.then((v) => this.memory.set(s, v), () => this.inflight.delete(s)); // a failed string may be retried later
    this.report();
    // wait a moment so one render's worth of text goes out together
    if (!this.flushTimer) this.flushTimer = setTimeout(() => { this.flushTimer = null; this.next(); }, 40);
    return np;
  }

  /** Distance (px) from the visible part of the window; 0 when on screen. Hidden elements go last. */
  private distance(job: Job) {
    const vh = window.innerHeight;
    let best = Infinity;
    for (const el of job.els) {
      if (!el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const d = r.bottom < 0 ? -r.bottom : r.top > vh ? r.top - vh : 0;
      if (d < best) best = d;
      if (best === 0) break;
    }
    return best;
  }

  private next() {
    while (!this.stopped && this.running < this.engine.parallel && this.jobs.size) {
      // nearest the screen first
      const order = [...this.jobs.values()].map((j) => [this.distance(j), j] as const).sort((a, b) => a[0] - b[0]);
      const batch: Job[] = [];
      let chars = 0;
      for (const [, j] of order) {
        if (batch.length >= this.engine.batchSize || (batch.length && chars + j.s.length > BATCH_CHARS)) break;
        batch.push(j); chars += j.s.length;
        this.jobs.delete(j.s);
      }
      this.running++;
      this.engine.translate(batch.map((j) => j.s)).then(
        (out) => batch.forEach((j, i) => (typeof out[i] === "string" ? j.resolve(out[i]) : j.reject(new Error("missing")))),
        (e) => { batch.forEach((j) => j.reject(e)); if (!this.stopped) this.onError(e); },
      ).finally(() => {
        this.running--;
        this.report();
        this.next();
      });
    }
  }

  private report() { if (!this.stopped) this.onPending(this.jobs.size + this.running); }
}
