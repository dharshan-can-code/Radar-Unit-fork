"use client";
import { useRouter } from "next/navigation";
import Story from "@/components/Story";
import { AREA, useSite } from "@/components/site/SiteState";
import { STORY } from "@/components/site/nav";
import { resultQuery } from "@/lib/data";

/** Your Story: a narrated, chaptered documentary of what the radar saw at a place the reader chooses. */
export default function StoryPage() {
  const router = useRouter();
  const { m, grid, rain, showLive, backToCase, href } = useSite();
  const shareUrl = m && m.area !== AREA && typeof window !== "undefined"
    ? `${window.location.origin}${STORY}?${resultQuery(m)}` : null;
  return (
    <Story m={m} grid={grid} rain={rain} onResult={(r) => showLive(r, true)} onCase={backToCase}
      onOpenMap={() => router.push(href("/explore", "explorer"))} shareUrl={shareUrl} />
  );
}
