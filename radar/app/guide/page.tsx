import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, BoxSelect, CloudRain, Crosshair, Download, Globe2, HelpCircle, Layers, Link2, MousePointer2, Radar,
  Satellite, Search, SplitSquareHorizontal, Zap,
} from "lucide-react";

export const metadata: Metadata = {
  title: "User Guide · DELTA PULSE",
  description: "How to use DELTA PULSE to see changes in water and land with NASA-ISRO NISAR radar.",
};

const TAGS = [
  ["OBSERVED", "border-cyan/40 text-cyan bg-cyan/10", "Measured directly by the satellite (or a weather dataset)."],
  ["CALCULATED", "border-blue/40 text-blue bg-blue/10", "Simple maths on those measurements, like averages and differences."],
  ["INTERPRETED", "border-amber/40 text-amber bg-amber/10", "A possible explanation. The app also tells you the other explanations."],
  ["UNCONFIRMED", "border-rose/40 text-rose bg-rose/10", "Needs more evidence before anyone should rely on it."],
] as const;

const BADGES = [
  ["VALIDATED", "border-green/50 text-green bg-green/10", "NASA's fully checked science data. The most trustworthy."],
  ["PROVISIONAL", "border-cyan/50 text-cyan bg-cyan/10", "Calibrated and mostly checked. Good for comparisons."],
  ["URGENT RESPONSE", "border-amber/50 text-amber bg-amber/10", "The very newest images, released quickly for events. Not fully checked yet."],
] as const;

const FAQ: [string, string][] = [
  ["Is this live?", "The app searches NASA's archive the moment you ask. But the satellite only passes over each place about every 12 days, and images appear after NASA processes them, so the newest picture may be a few days old. Every image shows the date it was taken."],
  ["Does a dark patch mean flooding?", "Not on its own. Calm water looks dark, but so can very smooth fields. Bright patches can be flooded trees, but also buildings. That's why DELTA PULSE never says \"flooded\": it shows what changed and what else would be needed to be sure."],
  ["Why can't I pick a grey option?", "Grey stacks are early test data from before NASA calibrated the satellite. They aren't reliable enough to compare."],
  ["Why do some dates show a small amber \"HH\"?", "On those days the satellite only recorded one of its two radar channels, so some numbers will show \"not measured\"."],
  ["It says there is no data for my place.", "NISAR mostly images land and coasts. Open ocean, or the very edge of a satellite strip, may have nothing. Try a point a little further inland."],
  ["It says the archive is busy.", "NASA's servers are getting a lot of requests. Wait a minute and press Analyse again."],
  ["Is my search private?", "Place names you type are sent to OpenStreetMap to find the location, and coordinates are sent to NASA and to the weather service. Nothing about you personally is sent."],
];

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 rounded-xl border border-line bg-panel p-5">
      <div className="flex flex-col items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan font-mono text-sm font-semibold text-bg">{n}</span>
        <span className="text-cyan">{icon}</span>
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-text">{title}</h3>
        <div className="mt-1 space-y-2 text-[14px] leading-relaxed text-text/80">{children}</div>
      </div>
    </div>
  );
}

const Btn = ({ children }: { children: React.ReactNode }) => (
  <span className="mx-0.5 inline-flex items-center gap-1 rounded-md border border-line bg-panel-2 px-1.5 py-0.5 align-middle text-[12px] text-text">{children}</span>
);

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-14 scroll-mt-6">
      <h2 className="mb-4 text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function Guide() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
      <div className="flex items-center justify-between pt-6">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-cyan hover:text-text"><ArrowLeft size={15} />Back to the app</Link>
        <span className="flex items-center gap-2 font-mono text-xs tracking-widest text-cyan"><Radar size={14} />DELTA PULSE</span>
      </div>

      <header className="pt-8">
        <h1 className="text-4xl font-semibold tracking-tight">User Guide</h1>
        <p className="mt-3 text-lg text-text/80">
          DELTA PULSE lets you see how water and land changed anywhere on Earth, using radar images from the
          NASA-ISRO <b>NISAR</b> satellite. Radar works through clouds and at night, so it can reveal flooding that
          normal satellite photos miss.
        </p>
        <p className="mt-2 text-[14px] text-muted">You don&apos;t need to know anything about radar. This guide takes about 5 minutes to read.</p>
        <nav className="mt-6 flex flex-wrap gap-2 text-[13px]">
          {[["start", "Quick start"], ["map", "Reading the map"], ["fingerprint", "Understanding the results"],
            ["anywhere", "Explore any place"], ["story", "Your Story"], ["more", "More to explore"], ["save", "Save & share"], ["labels", "What the labels mean"], ["faq", "Questions"]].map(([id, t]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-line px-3 py-1 text-muted hover:border-cyan/50 hover:text-text">{t}</a>
          ))}
        </nav>
      </header>

      <Section id="start" title="Quick start: 3 steps">
        <div className="grid gap-3">
          <Step n={1} icon={<SplitSquareHorizontal size={16} />} title="Look at the example">
            <p>Use the bar at the top to jump between sections. The app opens on <b>Tonle Sap Lake in Cambodia</b>, which swells enormously every monsoon. Drag the round <Btn>⇔</Btn> handle on the map left and right to compare two dates.</p>
          </Step>
          <Step n={2} icon={<MousePointer2 size={16} />} title="Click anywhere on the map">
            <p>The <b>Radar Change Fingerprint</b> below the map tells you, in plain words, what changed at that spot and how sure we can be.</p>
          </Step>
          <Step n={3} icon={<Search size={16} />} title="Try your own place">
            <p>Type a place like <i>Jakarta</i> or <i>New Orleans</i> into the search box at the top, press <Btn><Search size={11} />Search</Btn>, then <Btn>▶ Analyse</Btn>. After about 10–15 seconds the whole page shows real radar for your place.</p>
          </Step>
        </div>
      </Section>

      <Section id="map" title="Reading the map">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-line bg-panel p-5">
            <h3 className="font-semibold">Dark and bright</h3>
            <div className="mt-3 h-3 rounded" style={{ background: "linear-gradient(90deg,#000,#fff)" }} />
            <div className="mt-1 flex justify-between text-[12px] text-muted"><span>dark = smooth (calm water)</span><span>bright = rough (trees, buildings)</span></div>
            <p className="mt-3 text-[14px] text-text/80">Radar images aren&apos;t photos. Brightness shows how much of the radar signal bounced back. Calm water reflects it away, so it looks <b>black</b>. Flooded forests and towns bounce it straight back, so they look <b>very bright</b>.</p>
          </div>
          <div className="rounded-xl border border-line bg-panel p-5">
            <h3 className="font-semibold">Three views</h3>
            <ul className="mt-3 space-y-2 text-[14px] text-text/80">
              <li><Btn><SplitSquareHorizontal size={11} />Before / After</Btn> the two radar images, side by side under the slider.</li>
              <li><Btn><Layers size={11} />Measured change</Btn> <span className="text-amber">amber</span> got brighter, <span className="text-blue">blue</span> got darker.</li>
              <li><Btn><BoxSelect size={11} />Screening</Btn> <span className="text-cyan">cyan</span> may be open water, <span className="text-amber">amber</span> may be flooded plants (or buildings).</li>
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-panel p-5">
            <h3 className="font-semibold">Choosing dates</h3>
            <p className="mt-2 text-[14px] text-text/80">The buttons above the map, like <Btn><span className="font-mono">09-11 → 09-23</span></Btn>, pick which two dates you compare. A small red number such as <span className="font-mono text-rose">24d</span> means the gap was longer than the usual 12 days.</p>
          </div>
          <div className="rounded-xl border border-line bg-panel p-5">
            <h3 className="font-semibold">Handy tools</h3>
            <ul className="mt-2 space-y-1.5 text-[14px] text-text/80">
              <li><Btn>HH</Btn> / <Btn>HV</Btn> switch radar channel. HH is best for water, HV for plants.</li>
              <li><Btn>Opacity</Btn> fades the radar so you can see the map underneath.</li>
              <li><Btn><Satellite size={11} />Optical context</Btn> shows a normal satellite photo underneath (not from the same day).</li>
              <li><Btn><MousePointer2 size={11} />Draw region</Btn> drag a box to study a bigger area. <Btn>Whole area</Btn> resets it.</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section id="fingerprint" title="Understanding the results">
        <p className="text-[14px] text-text/80">Below the map, the <b>Radar Change Fingerprint</b> explains the area you clicked or drew.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            ["The verdict", "A one-line summary, for example \"Possible inundation-related signal\" or \"No significant radar change\"."],
            ["The statements", "Short sentences explaining what was measured, what changed, what might explain it and what is still unknown."],
            ["HH and HV cards", "How bright the area was before and after. \"+3 dB\" means the area became twice as bright."],
            ["The bar chart", "How many small squares in your area got brighter (amber) or darker (blue)."],
            ["Through time", "The area's brightness on every date the satellite passed over."],
            ["Daily rainfall", "How much it rained at that place. Heavy rain can change the radar too, so this helps explain changes."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-line bg-panel p-4">
              <div className="text-sm font-semibold">{t}</div>
              <p className="mt-1 text-[13px] text-text/75">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-rose/30 bg-rose/5 p-4 text-[14px] text-text/85">
          <b className="text-rose">Important:</b> DELTA PULSE never says an area <i>is</i> flooded. Radar changes can have several
          causes. When something looks like flooding, the app tells you what would confirm it, such as a water-level gauge, a clear
          photo or someone checking on the ground.
        </div>
      </Section>

      <Section id="anywhere" title="Explore any place in the world">
        <div className="grid gap-3">
          <Step n={1} icon={<Globe2 size={16} />} title="Choose a place: three ways">
            <ul className="list-disc space-y-1 pl-5">
              <li><b>Type</b> a name or coordinates (e.g. <i>Manaus</i> or <i>22.02, 89.31</i>) and press <Btn><Search size={11} />Search</Btn>.</li>
              <li><b>Click</b> a coloured strip on the <i>Newest NISAR acquisitions worldwide</i> map. Each strip is an image the satellite took recently.</li>
              <li>Press <Btn><Crosshair size={11} />Analyse a new place here</Btn> and click anywhere on the main map.</li>
            </ul>
          </Step>
          <Step n={2} icon={<Satellite size={16} />} title="Pick the images">
            <p>You&apos;ll see a list of <b>stacks</b>: groups of images taken from the same angle, so they can be compared fairly. The best one is already selected.</p>
            <p>Two dates are selected for you (the newest pair). Click dates to add or remove them. You can choose up to 12.</p>
          </Step>
          <Step n={3} icon={<Zap size={16} />} title="Choose speed and size, then analyse">
            <ul className="list-disc space-y-1 pl-5">
              <li><Btn><Zap size={11} />Quick 80 m</Btn> about 10 seconds, less detail. Good for a first look.</li>
              <li><Btn>Detailed 40 m</Btn> about 15 seconds for two dates, sharper.</li>
              <li><Btn>10 km</Btn> <Btn>20 km</Btn> <Btn>40 km</Btn> how big an area around your point.</li>
            </ul>
            <p>Press <Btn>▶ Analyse</Btn>. A bar shows progress, and then the whole page switches to your place. A <span className="text-cyan">Live:</span> bar above the map tells you where you are. <Btn><ArrowLeft size={11} />Tonle Sap case study</Btn> takes you back.</p>
          </Step>
        </div>
        <h3 className="mt-6 font-semibold">What the coloured badges mean</h3>
        <div className="mt-2 grid gap-2">
          {BADGES.map(([b, cls, d]) => (
            <div key={b} className="flex items-center gap-3 text-[14px]">
              <span className={`w-40 shrink-0 rounded border px-2 py-0.5 text-center font-mono text-[11px] ${cls}`}>{b}</span>
              <span className="text-text/80">{d}</span>
            </div>
          ))}
          <p className="text-[13px] text-muted">Different badges are never mixed in one comparison, because their numbers wouldn&apos;t match up fairly.</p>
        </div>
      </Section>

      <Section id="story" title="Your Story: an animated story of any place">
        <div className="rounded-xl border border-amber/40 bg-amber/5 p-5 text-[14px] leading-relaxed text-text/85">
          <p>Click <Btn><span className="text-amber">✦ Your Story</span></Btn> in the top bar. Type any place (your hometown works) and press <Btn>Tell its story</Btn>.
            In 20–40 seconds DELTA PULSE reads the newest real NISAR images of that place and turns them into a story you can scroll through,
            or press <Btn>▶ Play the story</Btn> to watch it play by itself.</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li><b>Above the clouds:</b> how cloudy it was at the exact hour the satellite passed.</li>
            <li><b>What the radar saw:</b> an animation of every radar image.</li>
            <li><b>The hidden water:</b> how much water-like ground there was on each pass.</li>
            <li><b>The moment it changed</b> and <b>How sure are we?</b>: the biggest change, and what would confirm it.</li>
          </ul>
          <p className="mt-3">Press <Btn><span>Share this story</span></Btn> at the end to copy a link to it.</p>
        </div>
      </Section>

      <Section id="more" title="More things to explore">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Sound in Your Story", "Press “Turn sound on”. A voice reads each chapter, soft rain follows the real rainfall, and “Hear the water” plays one note per satellite pass: higher notes mean more water."],
            ["Globe", "A spinning 3D globe of every NISAR image taken in the last day, 3 days or week. Click any strip to explore it."],
            ["Water Now", "Live weather at your place, river flow for the past 6 months plus a 30-day forecast, and NASA’s normal camera photo from the same day as each radar image. Drag the slider to see what the clouds hid."],
            ["Scatter Lab", "Every real radar pixel as a dot. Drag the coloured lines to change what counts as water and watch the map change."],
            ["Radar Lab", "Add water, trees and wind, switch the radar wavelength, and see why NISAR can find flooding under forest. (A teaching model, not data.)"],
            ["3D terrain", "On the main map, press “3D terrain” to lay the radar over real hills and valleys. Choose “Basemap: NASA same day” to see NASA’s photo from that date underneath."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-lg border border-line bg-panel p-4"><div className="text-sm font-semibold">{t}</div><p className="mt-1 text-[13px] text-text/75">{d}</p></div>
          ))}
        </div>
      </Section>

      <Section id="save" title="Save, download and share">
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            [<Link2 key="i" size={15} />, "Share link", "Copies a web link that reopens exactly this result. Send it to a teammate or teacher (they need the app running too)."],
            [<Download key="i" size={15} />, "CSV", "Downloads the numbers as a spreadsheet you can open in Excel or Google Sheets."],
            [<Download key="i" size={15} />, "Change map", "Downloads the change picture for the dates you're comparing."],
            [<Download key="i" size={15} />, "Data (JSON)", "Every number plus where it came from, for the technically curious."],
            [<HelpCircle key="i" size={15} />, "Recent analyses", "Under the search box. Reopens places analysed before, instantly."],
            [<CloudRain key="i" size={15} />, "Rainfall", "Shown automatically under the time chart for every place."],
          ].map(([icon, t, d]) => (
            <div key={t as string} className="flex gap-3 rounded-lg border border-line bg-panel p-4">
              <span className="text-cyan">{icon}</span>
              <div><div className="text-sm font-semibold">{t}</div><p className="text-[13px] text-text/75">{d}</p></div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="labels" title="What the labels mean">
        <p className="text-[14px] text-text/80">Every sentence in the results has a label, so you always know how much to trust it:</p>
        <div className="mt-3 grid gap-2">
          {TAGS.map(([t, cls, d]) => (
            <div key={t} className="flex items-center gap-3 text-[14px]">
              <span className={`w-32 shrink-0 rounded border px-2 py-0.5 text-center font-mono text-[11px] tracking-wider ${cls}`}>{t}</span>
              <span className="text-text/80">{d}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section id="faq" title="Questions">
        <div className="grid gap-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="rounded-lg border border-line bg-panel p-4">
              <summary className="cursor-pointer text-sm font-semibold text-text">{q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed text-text/80">{a}</p>
            </details>
          ))}
        </div>
      </Section>

      <footer className="mt-14 border-t border-line pt-6 text-[13px] text-muted">
        <p>Data: NASA-ISRO NISAR radar from NASA&apos;s Alaska Satellite Facility archive; rainfall from ERA5 via Open-Meteo; place search by OpenStreetMap. Everything shown is real data. Nothing is simulated.</p>
        <p className="mt-2">DELTA PULSE is a student project by RADAR UNIT for the NASA Space Apps Challenge 2026, and is not an official NASA product.</p>
        <Link href="/" className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-cyan px-4 py-2 text-sm font-medium text-bg"><ArrowLeft size={14} />Back to the app</Link>
      </footer>
    </main>
  );
}
