"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import { BrandMark } from "@/components/ui";
import ThemeToggle from "@/components/ThemeToggle";
import { PAGES, STORY, type NavItem, type NavPage } from "@/components/site/nav";
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

/** Navigation shared by the sidebar and the top-bar menu: a link to a page (and section or lab tool),
 *  which on the page already open just scrolls there. */
export function useNavLinks() {
  const pathname = usePathname();
  const { href, deepTab, setDeepTab } = useSite();
  const current = PAGES.find((p) => p.href === pathname) ?? null;
  const active = useSectionSpy(current);
  const target = (p: NavPage, x: NavItem) => href(p.href, x.id);
  const onClick = (p: NavPage, x: NavItem, e: React.MouseEvent, after?: () => void) => {
    after?.();
    if (x.tab) setDeepTab(x.id);
    if (p.href !== pathname) return; // a real navigation; the router scrolls to the hash
    e.preventDefault();
    window.history.replaceState(null, "", target(p, x));
    if (x.tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    document.getElementById(x.id)?.scrollIntoView({ behavior: "smooth" });
  };
  const isOn = (p: NavPage, x: NavItem) => p.href === pathname && (x.tab ? deepTab === x.id : active === x.id);
  return { pathname, current, target, onClick, isOn, href };
}

/** Desktop left sidebar (xl and up): one group per page, with links to the sections on it, Your Story,
 *  User guide, collapsible to icons. Narrower screens use the top bar in Navbar.tsx. */
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

  return (
    <aside aria-label="Pages" style={{ width: "var(--sidebar-w)" }}
      className="fixed inset-y-0 left-0 z-[60] hidden flex-col border-r border-line bg-bg transition-[width] duration-200 motion-reduce:transition-none xl:flex">
      {/* brand + collapse */}
      <div className={`flex h-[52px] shrink-0 items-center border-b border-line ${collapsed ? "justify-center" : "justify-between pr-2 pl-4"}`}>
        <Link href={href("/")} className="flex items-center gap-2 font-display text-[15px] font-semibold tracking-[0.04em] text-text"
          title="DELTA PULSE: home" aria-label="DELTA PULSE: home">
          <span className="text-accent"><BrandMark /></span>{!collapsed && "DELTA PULSE"}
        </Link>
        {!collapsed && (
          <button onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar"
            className="rounded-md p-1.5 text-muted hover:bg-panel hover:text-text"><ChevronsLeft size={16} /></button>
        )}
      </div>

      {/* pages, and the sections on each */}
      <nav aria-label="Main" className="no-scrollbar flex-1 overflow-y-auto px-2 pt-3 pb-4">
        {PAGES.map((p, gi) => {
          const here = p.href === pathname;
          return (
            <div key={p.href} className={gi === 0 ? "" : "mt-4"}>
              {collapsed
                ? (gi > 0 && <div className="mx-3 mb-2 h-px bg-line" />)
                : (
                  <Link href={href(p.href)} aria-current={here ? "page" : undefined}
                    className={`flex items-center gap-2 px-3 pb-1.5 text-[12px] ${here ? "text-text" : "text-muted hover:text-text"}`}>
                    {here && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />}{p.title}
                  </Link>
                )}
              <ul className="space-y-0.5">
                {p.items.map((x) => {
                  const on = isOn(p, x);
                  return (
                    <li key={x.id}>
                      <Link href={target(p, x)} onClick={(e) => onClick(p, x, e)} aria-current={on ? "location" : undefined}
                        title={collapsed ? `${p.title}: ${x.label}` : undefined} aria-label={collapsed ? `${p.title}: ${x.label}` : undefined}
                        className={`flex w-full items-center rounded-md py-1.5 text-[13px] ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${on ? "bg-accent/10 text-accent" : "text-muted hover:bg-panel hover:text-text"}`}>
                        <x.icon size={16} className="shrink-0" />
                        {!collapsed && <span className="truncate">{x.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* story + guide + expand */}
      <div className="shrink-0 space-y-1 border-t border-line p-2">
        <Link href={href(STORY)} aria-current={story ? "page" : undefined} title={collapsed ? "Your Story" : undefined} aria-label="Your Story"
          className={`flex w-full items-center rounded-md border py-2 text-[13px] font-medium ${collapsed ? "justify-center" : "gap-3 px-3"} ${story ? "border-amber bg-amber/15 text-amber" : "border-amber/45 text-amber hover:border-amber hover:bg-amber/10"}`}>
          <Sparkles size={15} className="shrink-0" />{!collapsed && "Your Story"}
        </Link>
        <ThemeToggle compact={collapsed} className={`w-full border-transparent py-2 ${collapsed ? "justify-center" : "gap-3 px-3"}`} />
        <Link href="/guide" title={collapsed ? "User guide" : undefined} aria-label="User guide"
          className={`flex items-center rounded-md py-2 text-[13px] text-muted hover:bg-panel hover:text-text ${collapsed ? "justify-center" : "gap-3 px-3"}`}>
          <BookOpen size={16} className="shrink-0" />{!collapsed && "User guide"}
        </Link>
        {collapsed && (
          <button onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar"
            className="flex w-full justify-center rounded-md py-2 text-muted hover:bg-panel hover:text-text"><ChevronsRight size={16} /></button>
        )}
      </div>
    </aside>
  );
}
