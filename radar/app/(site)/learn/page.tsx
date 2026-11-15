import type { Metadata } from "next";
import LearnPage from "@/components/pages/LearnPage";

export const metadata: Metadata = {
  title: "Learn more · DELTA PULSE",
  description: "Who hidden-water maps help, how L-band radar sees wetlands, and the full methods and data.",
};

export default function Page() {
  return <LearnPage />;
}
