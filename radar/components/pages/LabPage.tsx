"use client";
import { useEffect } from "react";
import DeepDive, { DEEP_ICONS } from "@/components/DeepDive";
import Timeline from "@/components/Timeline";
import ChangeByInterval from "@/components/ChangeByInterval";
import WaterNow from "@/components/WaterNow";
import RadarLab from "@/components/RadarLab";
import ScatterLab from "@/components/ScatterLab";
import { PageHeader, Section } from "@/components/site/Section";
import { useSite } from "@/components/site/SiteState";

const TABS = ["now", "scatter", "lab", "timeline"];

/** Live and lab: live conditions, the two interactive labs and the full observation record, behind tabs. */
export default function LabPage() {
  const { m, grid, rain, inv, source, pairIdx, setPairIdx, deepTab, setDeepTab } = useSite();
  const tab = TABS.includes(deepTab) ? deepTab : TABS[0];

  // /lab#scatter opens that tool, so a tool can be linked to directly.
  useEffect(() => {
    const fromHash = () => { const h = window.location.hash.slice(1); if (TABS.includes(h)) setDeepTab(h); };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [setDeepTab]);
  const open = (id: string) => {
    setDeepTab(id);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`);
  };

  return (
    <>
      <PageHeader title="Live and lab"
        lead="Today's conditions at this place, two hands-on labs that show how the radar decides what is water, and every satellite pass on record." />

      <Section id="deeper" first title="Tools for the curious"
        lead="Each tool works on the place on screen: the Tonle Sap case study, or any place you opened on the Explore page.">
        <DeepDive active={tab} onActiveChange={open} tabs={[
          { id: "now", label: "Water now", icon: DEEP_ICONS.now, blurb: "Live weather, river flow with a 30-day forecast, and NASA's camera view from the same day as each radar pass.",
            render: () => <WaterNow m={m ?? null} rain={rain} /> },
          { id: "scatter", label: "Scatter Lab", icon: DEEP_ICONS.scatter, blurb: "Every radar pixel plotted by its two channels. Drag the thresholds and watch the water map change.",
            render: () => <ScatterLab m={m ?? null} grid={grid} /> },
          { id: "lab", label: "Radar Lab", icon: DEEP_ICONS.lab, blurb: "A teaching model: add water, trees and wind, switch wavelength, and see why NISAR's L-band finds flooding under forest.",
            render: () => <RadarLab screening={m?.screening ?? null} /> },
          { id: "timeline", label: "Every pass", icon: DEEP_ICONS.timeline, blurb: "Every NISAR acquisition over the study areas, and how much changed between each pair of passes.",
            render: () => (<>
              {source === "case" && (inv ? <Timeline inventory={inv} manifest={m ?? null} pairIdx={pairIdx} setPairIdx={setPairIdx} /> : <p className="text-muted">Inventory not found — run scripts/refresh.py.</p>)}
              {m && m.pairs.length > 0 && <ChangeByInterval m={m} pairIdx={pairIdx} setPairIdx={setPairIdx} />}
            </>) },
        ]} />
      </Section>
    </>
  );
}
