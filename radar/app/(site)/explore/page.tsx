import type { Metadata } from "next";
import ExplorePage from "@/components/pages/ExplorePage";

export const metadata: Metadata = {
  title: "Explore the data · DELTA PULSE",
  description: "NISAR radar images on a map, the evidence for any area you pick, the independent checks, and the same analysis for any place on Earth.",
};

export default function Page() {
  return <ExplorePage />;
}
