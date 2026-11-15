// Translates batches of page text with Microsoft Azure Translator, for every browser.
// Runs on the site's own server (Vercel or `next dev`), so it needs no Python backend.
// Settings (never commit them; put them in .env.local and in Vercel's environment variables):
//   AZURE_TRANSLATOR_KEY      the resource's key
//   AZURE_TRANSLATOR_REGION   the resource's region, e.g. "eastus" (not needed for a "global" resource)
import { NextResponse } from "next/server";
import { LANGUAGES, type LanguageCode } from "@/lib/i18n/translations";

export const runtime = "nodejs";

//   AZURE_TRANSLATOR_ENDPOINT optional: another Translator endpoint (regional, or a local stand-in for tests)
const ENDPOINT = (process.env.AZURE_TRANSLATOR_ENDPOINT || "https://api.cognitive.microsofttranslator.com") + "/translate";
const MAX_ITEMS = 200;        // per request from a page
const MAX_CHARS = 20_000;     // per request from a page (Azure allows 50,000)
const MAX_ITEM_CHARS = 5_000;
const CACHE_MAX = 20_000;

/** Azure's code for a site language. */
const azureCode = (c: LanguageCode) => (c === "zh-CN" ? "zh-Hans" : c === "zh-TW" ? "zh-Hant" : c);

// Translations this server instance has already fetched (lang + "\u0000" + text -> translation).
const cache = new Map<string, string>();
const remember = (k: string, v: string) => {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(k, v);
};

/** Whether translation is set up here, so a page can pick another way before sending text. */
export async function GET() {
  return NextResponse.json({ configured: !!process.env.AZURE_TRANSLATOR_KEY, provider: "Microsoft Translator" });
}

export async function POST(req: Request) {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  if (!key) return NextResponse.json({ error: "Translation is not set up on this server." }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return bad("Expected JSON."); }
  const { to, texts } = (body ?? {}) as { to?: unknown; texts?: unknown };
  const lang = LANGUAGES.find((l) => l.code === to)?.code;
  if (!lang || lang === "en") return bad("Unknown target language.");
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > MAX_ITEMS || !texts.every((t) => typeof t === "string"))
    return bad(`texts must be 1-${MAX_ITEMS} strings.`);
  const items = texts as string[];
  if (items.some((t) => t.length > MAX_ITEM_CHARS) || items.reduce((n, t) => n + t.length, 0) > MAX_CHARS)
    return bad("Too much text in one request.");

  const out: (string | null)[] = items.map((t) => cache.get(lang + "\u0000" + t) ?? null);
  const todo = [...new Set(items.filter((_, i) => out[i] == null))];

  if (todo.length) {
    const headers: Record<string, string> = { "Ocp-Apim-Subscription-Key": key, "Content-Type": "application/json; charset=UTF-8" };
    if (process.env.AZURE_TRANSLATOR_REGION) headers["Ocp-Apim-Subscription-Region"] = process.env.AZURE_TRANSLATOR_REGION;
    const url = `${ENDPOINT}?api-version=3.0&from=en&to=${encodeURIComponent(azureCode(lang))}&textType=plain`;
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body: JSON.stringify(todo.map((Text) => ({ Text }))), signal: AbortSignal.timeout(15_000) });
    } catch {
      return NextResponse.json({ error: "The translation service did not answer." }, { status: 502 });
    }
    if (!res.ok) {
      // Azure explains (e.g. bad key, quota used up) without echoing the key; pass on only the message.
      let msg = `The translation service refused (${res.status}).`;
      try { const e = (await res.json()) as { error?: { message?: string } }; if (e.error?.message) msg += ` ${e.error.message}`; } catch { /* keep the short message */ }
      return NextResponse.json({ error: msg }, { status: res.status === 429 ? 429 : 502 });
    }
    const data = (await res.json()) as { translations: { text: string }[] }[];
    todo.forEach((t, i) => { const v = data[i]?.translations?.[0]?.text; if (typeof v === "string") remember(lang + "\u0000" + t, v); });
  }

  const translations = items.map((t, i) => out[i] ?? cache.get(lang + "\u0000" + t) ?? t);
  return NextResponse.json({ translations }, { headers: { "Cache-Control": "no-store" } });
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
