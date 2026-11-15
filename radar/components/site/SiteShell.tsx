"use client";
import { usePathname } from "next/navigation";
import { AlertTriangle, HelpCircle } from "lucide-react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import Help from "@/components/Help";
import { BrandMark } from "@/components/ui";
import { NextPage } from "@/components/site/Section";
import { SiteProvider, useSite } from "@/components/site/SiteState";
import { STORY } from "@/components/site/nav";
import { LanguageProvider, useLanguage } from "@/components/site/LanguageContext";
import PageTranslation from "@/components/site/PageTranslation";

/** The frame around every page: sidebar (xl+) or top bar, the demonstration-data warning, and the footer. */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  return <LanguageProvider><SiteProvider><Shell>{children}</Shell></SiteProvider></LanguageProvider>;
}
function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { m, help, setHelp } = useSite();
  const story = pathname === STORY;
  const { t } = useLanguage();
  return (
    <div className="transition-[padding-left] duration-200 motion-reduce:transition-none xl:pl-[var(--sidebar-w)]">
      <a href="#content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent">{t("skip")}</a>
      <Sidebar />
      <Navbar />
      <main id="content" tabIndex={-1} className="mx-auto max-w-[1400px] px-4 pb-16 outline-none sm:px-6">
        <PageTranslation />
        {!story && m?.is_demonstration && (
          <div role="alert" className="sticky top-[52px] z-50 -mx-4 flex items-center gap-2 border-b border-amber/40 bg-bg px-4 py-2 text-[13px] text-amber sm:-mx-6 sm:px-6 xl:top-0">
            <AlertTriangle size={16} className="shrink-0" />
            <span><b>DEMONSTRATION DATA.</b> Map layers and fingerprint numbers are synthetic test values, not NISAR measurements. The observation timeline uses real ASF acquisition metadata. Run the pipeline on downloaded GCOV files to replace them.</span>
          </div>
        )}
        {children}
        {help && <Help onClose={() => setHelp(false)} />}
        {!story && <NextPage />}
        <footer className="mt-24 border-t border-line pt-8 text-[13px] leading-relaxed text-muted">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[0.04em] text-text">
              <span className="text-accent"><BrandMark /></span>DELTA PULSE
            </span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <button onClick={() => setHelp(true)} className="flex items-center gap-1.5 text-accent hover:text-accent-strong"><HelpCircle size={14} />How to use</button>
              <Link href="/guide" className="text-accent hover:text-accent-strong">User guide</Link>
            </div>
          </div>
          <p className="mt-4 max-w-4xl">Team RADAR UNIT, NASA Space Apps 2026. An open-source student project; not an official NASA product.</p>
          <p className="mt-2 max-w-4xl">Data: NASA-ISRO NISAR L2 GCOV via NASA ASF DAAC; JRC Global Surface Water; ERA5 and GloFAS via Open-Meteo; NASA GIBS. Basemaps: Esri (© Esri and data providers, © OpenStreetMap contributors).</p>
        </footer>
      </main>
    </div>
  );
}
