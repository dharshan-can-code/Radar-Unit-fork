"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/ui";
import ThemeToggle from "@/components/ThemeToggle";
import { PAGES, PLACE_SECTIONS, STORY, type NavItem, type NavPage } from "@/components/site/nav";
import { useSite } from "@/components/site/SiteState";

/** Which section of the current page is in view (for the highlight), from the page's own section ids. */
export function useSectionSpy(page: NavPage | null) {
  const [active, setActive] = useState("");
  useEffect(() => {
    setActive("");
    if (!page) return;
    const els = page.items.filter((x) => !x.tab).map((x) => document.getElementById(x.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-80px 0px -55% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [page]);
  return active;
}

/** Navigation shared by the sidebar and the top-bar menu: a link to a page (and section or tool),
 *  which on the page already open just scrolls there. */
export function useNavLinks() {
  const pathname = usePathname();
  const { href, deepTab, setDeepTab, setPlacesOpen } = useSite();
  const current = PAGES.find((p) => p.href === pathname) ?? null;
  const active = useSectionSpy(current);
  const target = (p: NavPage, x: NavItem) => href(p.href, x.id);
  const onClick = (p: NavPage, x: NavItem, e: React.MouseEvent, after?: () => void) => {
    after?.();
    if (x.tab) setDeepTab(x.id);
    const chooser = PLACE_SECTIONS.includes(x.id);
    if (chooser) setPlacesOpen(true);
    if (p.href !== pathname) return; // a real navigation; the router scrolls to the hash
    e.preventDefault();
    window.history.replaceState(null, "", target(p, x));
    if (x.tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    // the chooser unfolds first, so wait a frame before scrolling to it
    setTimeout(() => document.getElementById(x.id)?.scrollIntoView({ behavior: "smooth" }), chooser ? 60 : 0);
  };
  const isOn = (p: NavPage, x: NavItem) => p.href === pathname && (x.tab ? deepTab === x.id : active === x.id);
  return { pathname, current, target, onClick, isOn, href };
}

/** Desktop left sidebar (xl and up): the pages in reading order, with the sections of the page that is
 *  open listed under it. Collapsible to icons; the collapse button stays in the top corner either way.
 *  Narrower screens use the top bar in Navbar.tsx. */
export default function Sidebar() {
  const { pathname, target, onClick, isOn, href } = useNavLinks();
  const [collapsed, setCollapsed] = useState(false);

  // remember the collapsed state (storage can be blocked, so every access is wrapped)
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("dp-sidebar-collapsed") === "1"); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", collapsed ? "4.5rem" : "16rem");
    try { localStorage.setItem("dp-sidebar-collapsed", collapsed ? "1" : "0"); } catch { /* ignore */ }
  }, [collapsed]);

  const story = pathname === STORY;
  const row = `flex w-full items-center rounded-md text-[14px] font-medium ${collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2"}`;
  const storyLink = (
    <li key={STORY}>
      <Link href={href(STORY)} aria-current={story ? "page" : undefined} title={collapsed ? "Your Story" : undefined} aria-label="Your Story"
        className={`${row} ${story ? "bg-amber/15 text-amber" : "text-amber hover:bg-amber/10"}`}>
        <Sparkles size={17} className="shrink-0" />{!collapsed && "Your Story"}
      </Link>
    </li>
  );

  return (
    <aside aria-label="Pages" style={{ width: "var(--sidebar-w)" }}
      className="fixed inset-y-0 left-0 z-[60] hidden flex-col border-r border-line bg-bg transition-[width] duration-200 motion-reduce:transition-none xl:flex">
      {/* brand + collapse / expand: the button keeps its place at the top in both states */}
      <div className={`flex h-[52px] shrink-0 items-center border-b border-line ${collapsed ? "justify-center" : "justify-between pr-2 pl-4"}`}>
        {!collapsed && (
          <Link href={href("/")} className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[0.04em] text-text"
            title="DELTA PULSE: home" aria-label="DELTA PULSE: home">
            <span className="text-accent"><BrandMark /></span>DELTA PULSE
          </Link>
        )}
        <button onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-md p-2 text-muted hover:bg-panel hover:text-text">
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      {/* the pages in reading order; the open page lists its sections */}
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {PAGES.flatMap((p, gi) => {
            const here = p.href === pathname;
            const page = (
              <li key={p.href}>
                <Link href={href(p.href)} aria-current={here ? "page" : undefined}
                  title={collapsed ? p.title : undefined} aria-label={collapsed ? p.title : undefined}
                  className={`${row} ${here ? "bg-accent/10 text-accent" : "text-text/85 hover:bg-panel hover:text-text"}`}>
                  <p.icon size={17} className="shrink-0" />{!collapsed && p.title}
                </Link>
                {here && !collapsed && (
                  <ul className="panel-in mt-1 mb-2 ml-[1.3rem] space-y-px border-l border-line pl-2">
                    {p.items.map((x) => {
                      const on = isOn(p, x);
                      return (
                        <li key={x.id}>
                          <Link href={target(p, x)} onClick={(e) => onClick(p, x, e)} aria-current={on ? "location" : undefined}
                            className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] ${on ? "font-medium text-accent" : "text-muted hover:bg-panel hover:text-text"}`}>
                            <x.icon size={14} className="shrink-0" /><span className="truncate">{x.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
            // Your Story sits right after exploring a place: it retells that place as a narrative.
            return gi === 1 ? [page, storyLink] : [page];
          })}
        </ul>
      </nav>

      {/* theme + guide */}
      <div className="shrink-0 space-y-1 border-t border-line p-2">
        <ThemeToggle compact={collapsed} className={`w-full border-transparent py-2 ${collapsed ? "justify-center" : "gap-3 px-3"}`} />
        <Link href="/guide" title={collapsed ? "User guide" : undefined} aria-label="User guide"
          className={`flex items-center rounded-md py-2 text-[13px] text-muted hover:bg-panel hover:text-text ${collapsed ? "justify-center" : "gap-3 px-3"}`}>
          <BookOpen size={16} className="shrink-0" />{!collapsed && "User guide"}
        </Link>
      </div>
    </aside>
  );
}
