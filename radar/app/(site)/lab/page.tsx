import type { Metadata } from "next";
import LabPage from "@/components/pages/LabPage";

export const metadata: Metadata = {
  title: "Go deeper · DELTA PULSE",
  description: "Live water conditions, the Scatter Lab and Radar Lab, and every NISAR pass on record.",
};

export default function Page() {
  return <LabPage />;
}
