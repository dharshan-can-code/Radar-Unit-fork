"use client";
import { useEffect, useState } from "react";
import { ExternalLink, Info } from "lucide-react";
import { PUBLIC_DEMO_NOTE, REPO_URL, isPublicDemo } from "@/lib/api";

/** isPublicDemo() after mount (server render always assumes the full app). */
export function useIsPublicDemo() {
  const [demo, setDemo] = useState(false);
  useEffect(() => { setDemo(isPublicDemo()); }, []);
  return demo;
}

/** Calm explanation shown on the public demo where a feature needs the live server. */
export default function PublicDemoNote({ what, compact }: { what?: string; compact?: boolean }) {
  return (
    <div role="status" className={`flex gap-2 rounded-lg border border-accent/30 bg-accent/5 text-[13px] leading-relaxed text-text/85 ${compact ? "p-2.5" : "p-3"}`}>
      <Info size={15} className="mt-0.5 shrink-0 text-accent" />
      <div>
        {what && <b className="text-text">{what} </b>}
        {PUBLIC_DEMO_NOTE}
        <a href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-1 text-accent hover:underline">
          Run the full app<ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
