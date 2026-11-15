"use client";
import Impact from "@/components/Impact";
import DataStatus from "@/components/DataStatus";
import { Methods, ScienceExplainer } from "@/components/Science";
import { PageHeader, Section } from "@/components/site/Section";
import { useSite } from "@/components/site/SiteState";

/** Learn more: who the results help, the physics, and the methods and data. */
export default function LearnPage() {
  const { m, source, status, stacks, stackId, setStackId } = useSite();
  return (
    <>
      <PageHeader title="Learn more"
        lead="Why hidden water matters, how L-band radar sees it, and everything needed to reproduce or challenge the analysis." />

      <Section id="impact" first title="Why hidden water matters"
        lead="Seasonal floods feed fisheries, farms and drinking water. Knowing where the water really is helps the people who depend on it.">
        <Impact />
      </Section>

      <Section id="science" title="The physics"
        lead="How L-band radar sees wetlands, in plain language.">
        <ScienceExplainer />
      </Section>

      <Section id="methods" title="Methods & data"
        lead="The processing chain, thresholds, data status and limitations: everything needed to reproduce or challenge the analysis.">
        {source === "case" && status && <div className="mb-4"><DataStatus status={status} stacks={stacks} stackId={stackId} setStackId={setStackId} manifest={m ?? null} /></div>}
        <Methods m={m ?? null} />
      </Section>
    </>
  );
}
