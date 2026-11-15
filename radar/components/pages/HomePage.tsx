"use client";
import { ArrowLeft } from "lucide-react";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Findings from "@/components/Findings";
import { Section } from "@/components/site/Section";
import { useSite } from "@/components/site/SiteState";
import { STORY } from "@/components/site/nav";

/** Start here: what DELTA PULSE is, how it works, and the headline findings. */
export default function HomePage() {
  const { m, grid, rain, validation, source, backToCase, href } = useSite();
  return (
    <>
      <Hero m={m} storyHref={href(STORY)} exploreHref={href("/explore")} />

      <Section id="how" title="From a radar echo to an answer you can trust"
        lead="Three steps, and four labels that tell you how certain each sentence is.">
        <HowItWorks />
      </Section>

      <Section id="findings" title={m ? `What NISAR saw at ${m.name.replace(/\s*\(.*\)$/, "")}` : "What NISAR saw"}
        lead={source === "case"
          ? "Tonle Sap is Southeast Asia's largest lake. Every monsoon it floods the forest around it, and that flood feeds one of the world's biggest inland fisheries. Here is what 10 radar passes from June to October 2026 show."
          : "The headline results for this place, computed from the same real NISAR passes shown on the Explore map."}
        aside={source === "live" ? <button onClick={backToCase} className="mt-3 flex items-center gap-1.5 text-[13px] text-accent hover:text-accent-strong"><ArrowLeft size={14} />Back to the Tonle Sap case study</button> : null}>
        <Findings m={m ?? null} grid={grid} rain={rain} validation={validation} linkTo={(id) => href("/explore", id)} />
      </Section>
    </>
  );
}
