"use client";
import { useRouter } from "next/navigation";
import Story from "@/components/Story";
import { AREA, useSite } from "@/components/site/SiteState";
import { STORY } from "@/components/site/nav";
import { resultQuery } from "@/lib/data";

/** Your Story: the guided, chaptered telling of what the radar saw. */
export default function StoryPage() {
  const router = useRouter();
  const { m, grid, rain, showLive, href } = useSite();
  const shareUrl = m && m.area !== AREA && typeof window !== "undefined"
    ? `${window.location.origin}${STORY}?${resultQuery(m)}` : null;
  return (
    <Story m={m ?? null} grid={grid} rain={rain} onResult={(r) => showLive(r, true)}
      onOpenMap={() => router.push(href("/explore", "explorer"))} shareUrl={shareUrl} />
  );
}
