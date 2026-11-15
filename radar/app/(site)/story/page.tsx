import type { Metadata } from "next";
import StoryPage from "@/components/pages/StoryPage";

export const metadata: Metadata = {
  title: "Your Story · DELTA PULSE",
  description: "A guided story of what NISAR radar saw at a place, chapter by chapter.",
};

export default function Page() {
  return <StoryPage />;
}
