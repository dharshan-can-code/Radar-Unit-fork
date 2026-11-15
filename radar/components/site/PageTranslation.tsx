"use client";
import { useEffect, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/site/LanguageContext";
import {
  azureEngine, deviceEngine, engineCode, PageTranslator, serverTranslation, translatorApi,
  type Engine, type TranslatorLike,
} from "@/lib/i18n/pageTranslator";

type Status = "off" | "checking" | "unavailable" | "needs-click" | "downloading" | "on" | "error";

/** Rejects if a promise does not settle in time (the on-device translator can hang when unavailable). */
const within = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** Translates everything inside the page (main#content) into the chosen language and says so:
 *  machine translation, English is the reference, one click back.
 *  Uses Microsoft Translator through the site's server (every browser); where that is not set up,
 *  the browser's own on-device translator (recent Chrome and Edge on a computer). */
export default function PageTranslation() {
  const { language, t } = useLanguage();
  const [status, setStatus] = useState<Status>("off");
  const [engineName, setEngineName] = useState("");
  const [problem, setProblem] = useState("");
  const [pending, setPending] = useState(0);
  const [progress, setProgress] = useState<number | null>(null);
  const [original, setOriginal] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState(false);

  useEffect(() => { setOriginal(false); }, [language]);

  // once the page is translated (nothing waiting for a moment), the banner steps aside
  useEffect(() => {
    if (status !== "on") { setSettled(false); return; }
    if (pending > 0) { setSettled(false); return; }
    const t = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(t);
  }, [status, pending]);

  useEffect(() => {
    if (language === "en" || original) { setStatus("off"); return; }
    let alive = true;
    let engine: Engine | null = null;
    let pt: PageTranslator | null = null;
    setStatus("checking");
    setProblem("");

    const run = (e: Engine) => {
      const root = document.getElementById("content");
      if (!root) return;
      engine = e;
      root.setAttribute("lang", language);
      pt = new PageTranslator(root, e, language, setPending, (err) => {
        if (!alive) return;
        setProblem(err instanceof Error ? err.message : "");
        setStatus("error");
      });
      pt.start();
      setEngineName(e.name);
      setStatus("on");
    };

    (async () => {
      // 1. Microsoft Translator through the site's server: works in every browser
      if (await serverTranslation()) { if (alive) run(azureEngine(language)); return; }
      if (!alive) return;

      // 2. the browser's own on-device translator
      const api = translatorApi();
      if (!api) { setStatus("unavailable"); return; }
      const opts = { sourceLanguage: "en", targetLanguage: engineCode(language) };
      let avail = "unavailable";
      try { avail = await within(api.availability(opts), 8000); } catch { /* treated as unavailable */ }
      if (!alive) return;
      if (avail === "unavailable") { setStatus("unavailable"); return; }
      if (avail !== "available") { setStatus("downloading"); setProgress(null); }
      let tr: TranslatorLike;
      try {
        const making = api.create({ ...opts, monitor(m) {
          m.addEventListener("downloadprogress", (e) => setProgress((e as ProgressEvent).loaded));
        } });
        // a ready model starts at once; a download may take minutes, so only a ready one is timed
        tr = avail === "available" ? await within(making, 15000) : await making;
      } catch {
        // downloading a language model needs a click; it also fails offline
        if (alive) setStatus(avail === "available" ? "error" : "needs-click");
        return;
      }
      if (!alive) { tr.destroy?.(); return; }
      run(deviceEngine(tr));
    })();

    return () => {
      alive = false;
      pt?.stop();
      (engine as Engine | null)?.destroy?.();
      document.getElementById("content")?.setAttribute("lang", "en");
      setPending(0);
    };
  }, [language, original, attempt]);

  if (language === "en" || (status === "on" && settled && !original)) return null;

  const btn = "shrink-0 rounded-md border border-line px-2.5 py-1 text-[12px] font-medium text-accent hover:border-accent/50";
  let body: React.ReactNode;
  if (original) {
    body = <>
      <span>Showing the English original.</span>
      <button onClick={() => setOriginal(false)} className={btn}>Translate</button>
    </>;
  } else if (status === "unavailable") {
    // nothing can translate here, so this line comes from the site's own translations
    body = <span>{t("note")}{!translatorApi() && <> {t("noEngine")}</>}</span>;
  } else if (status === "needs-click" || status === "error") {
    body = <>
      <span>{status === "needs-click"
        ? "Your browser needs to download its translator for this language once."
        : `Part of the page could not be translated.${problem ? ` ${problem}` : ""}`}</span>
      <button onClick={() => setAttempt((a) => a + 1)} className={btn}>{status === "needs-click" ? "Download and translate" : "Try again"}</button>
    </>;
  } else if (status === "checking") {
    body = <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />Preparing translation…</span>;
  } else if (status === "downloading") {
    body = <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />
      Downloading your browser&apos;s translator{progress != null ? ` (${Math.round(progress * 100)}%)` : ""}…</span>;
  } else if (status === "on") {
    body = <>
      <span>
        Machine-translated from English. Scientific terms may be imprecise: the English text is the reference.
        {engineName.startsWith("Microsoft") && <span translate="no" className="ml-1.5 text-muted">({engineName})</span>}
        {pending > 0 && <span className="ml-2 inline-flex items-center gap-1 text-muted"><Loader2 size={12} className="animate-spin" />{pending}</span>}
      </span>
      <button onClick={() => setOriginal(true)} className={btn}>Show original</button>
    </>;
  } else return null;

  return (
    <div role="status" className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-[13px] text-text">
      <Languages size={15} className="shrink-0 text-accent" aria-hidden />
      {body}
    </div>
  );
}
