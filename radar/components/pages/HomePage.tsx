"use client";
import { ArrowLeft } from "lucide-react";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Findings from "@/components/Findings";
import { Section } from "@/components/site/Section";
import { useSite } from "@/components/site/SiteState";
import { STORY } from "@/components/site/nav";

const month = (d: string, year = false) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });

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
          ? "Tonle Sap is Southeast Asia's largest lake. Every monsoon it floods the forest around it, and that flood feeds one of the world's biggest inland fisheries. " + (m && m.observations.length ? `Here is what ${m.observations.length} radar passes from ${month(m.observations[0].date)} to ${month(m.observations[m.observations.length - 1].date, true)} show.` : "")
          : "The headline results for this place, computed from the same real NISAR passes shown on the Explore map."}
        aside={source === "live" ? <button onClick={backToCase} className="mt-3 flex items-center gap-1.5 text-[13px] text-cyan hover:text-text"><ArrowLeft size={14} />Back to the Tonle Sap case study</button> : null}>
        <Findings m={m ?? null} grid={grid} rain={rain} validation={validation} linkTo={(id) => href("/explore", id)} />
      </Section>
    </>
  );
}
