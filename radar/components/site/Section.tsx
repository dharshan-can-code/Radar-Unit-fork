"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PAGES } from "@/components/site/nav";
import { useSite } from "@/components/site/SiteState";

/** The title block at the top of each page (the first page has the Hero instead). */
export function PageHeader({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="atmosphere relative -mx-4 px-4 pt-10 pb-4 sm:-mx-6 sm:px-6 sm:pt-14">
      <h1 className="text-[2.6rem] leading-[1.02] font-medium sm:text-6xl">{title}</h1>
      <p className="mt-5 max-w-[60ch] text-[17px] leading-relaxed text-text/80">{lead}</p>
    </header>
  );
}

export function Section({ id, title, lead, aside, first, children }: {
  id: string; title: string; lead: string; aside?: React.ReactNode;
  /** directly under a PageHeader, so it needs less room above */ first?: boolean; children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-16 ${first ? "mt-12 sm:mt-14" : "mt-20 sm:mt-28"}`}>
      <div className="rule-ticks" aria-hidden />
      <div className="mt-6 mb-8 grid gap-x-12 gap-y-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:items-end">
        <h2 className="text-[1.75rem] leading-[1.1] font-medium sm:text-[2.5rem]">{title}</h2>
        <div>
          <p className="max-w-[62ch] text-[15px] leading-relaxed text-text/75 sm:text-[16px]">{lead}</p>
          {aside}
        </div>
      </div>
      {children}
    </section>
  );
}

/** A link to the next page in reading order, at the foot of every page but the last. */
export function NextPage() {
  const pathname = usePathname();
  const { href } = useSite();
  const i = PAGES.findIndex((p) => p.href === pathname);
  const next = i >= 0 ? PAGES[i + 1] : undefined;
  if (!next) return null;
  return (
    <nav aria-label="Next page" className="mt-24">
      <Link href={href(next.href)}
        className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-panel px-5 py-5 hover:border-accent/50 sm:px-6">
        <span>
          <span className="block text-[12px] text-muted">Next</span>
          <span className="mt-1 block text-[1.35rem] font-medium text-text group-hover:text-accent sm:text-[1.6rem]">{next.title}</span>
          <span className="mt-1 block text-[13px] text-muted">{next.items.map((x) => x.label).join(" · ")}</span>
        </span>
        <ArrowRight size={22} className="shrink-0 text-accent transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
      </Link>
    </nav>
  );
}
