"use client";
// Shown if a section throws while rendering. The data on disk is unaffected:
// the visitor can retry, or go back to the Tonle Sap case study.
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="mx-auto flex min-h-[80svh] max-w-2xl flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-3xl leading-tight font-medium sm:text-4xl">This view could not be displayed.</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-text/80">
        Something went wrong while drawing this result. No data was changed. You can try again, or open the Tonle Sap
        case study, which works without the live server.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={reset} className="rounded-md bg-accent px-5 py-3 text-[15px] font-semibold text-on-accent hover:bg-accent-strong">Try again</button>
        {/* a full reload on purpose: it clears whatever state caused the failure */}
        <button onClick={() => window.location.assign("/")} className="rounded-md border border-line-strong px-5 py-3 text-[15px] font-medium text-text hover:border-accent hover:text-accent">Open the case study</button>
      </div>
      <p className="mt-8 font-mono text-[12px] break-words text-muted">{error.message}</p>
    </main>
  );
}
