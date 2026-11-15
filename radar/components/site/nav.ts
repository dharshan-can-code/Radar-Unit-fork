// The site's pages and what is on each, in reading order. The sidebar, the top bar menu
// and the "next page" link at the foot of each page all read from here.
import type { ComponentType } from "react";
import {
  Activity, CalendarDays, Compass, Droplets, FileText, Fingerprint, FlaskConical, Map as MapIcon,
  Microscope, Radar, Search, ShieldCheck, Telescope, Users, Waves, BookOpenText,
} from "lucide-react";
import type { LanguageCode, TKey } from "@/lib/i18n/translations";

export type Icon = ComponentType<{ size?: number; className?: string }>;

/** A place on a page: a section id on that page, or (tab) a tool in the Go deeper tabs.
 *  label is the English wording; key is the entry in lib/i18n/translations.ts used for other languages. */
export interface NavItem { id: string; label: string; key: TKey; icon: Icon; tab?: boolean }
/** hint: one line saying what the page is for, shown on the "next page" link. */
export interface NavPage { href: string; title: string; key: TKey; icon: Icon; hint: string; items: NavItem[] }

// A first visit reads top to bottom: what this is and one explained result, then a place of your
// own (choose it, read the answer, see it on the map, check the evidence), then the extras.
export const PAGES: NavPage[] = [
  { href: "/", key: "start", title: "Start here", icon: Compass, hint: "What DELTA PULSE is, and one result explained.", items: [
    { id: "how", key: "how", label: "How it works", icon: Radar },
    { id: "findings", key: "findings", label: "What we found", icon: Droplets },
  ] },
  { href: "/explore", key: "explore", title: "Explore a place", icon: MapIcon, hint: "Choose any place on Earth and read what the radar saw there.", items: [
    { id: "places", key: "search", label: "Choose a place", icon: Search },
    { id: "answer", key: "findings", label: "The short answer", icon: Droplets },
    { id: "explorer", key: "map", label: "The map", icon: MapIcon },
    { id: "fingerprint", key: "changes", label: "The evidence", icon: Fingerprint },
    { id: "checks", key: "checks", label: "Is it real?", icon: ShieldCheck },
  ] },
  { href: "/lab", key: "lab", title: "Go deeper", icon: Telescope, hint: "Today's conditions, every pass on record, and two hands-on labs.", items: [
    { id: "now", key: "waterNow", label: "Conditions today", icon: Waves, tab: true },
    { id: "timeline", key: "timeline", label: "Every pass", icon: CalendarDays, tab: true },
    { id: "lab", key: "radarLab", label: "Radar Lab", icon: FlaskConical, tab: true },
    { id: "scatter", key: "scatter", label: "Scatter Lab", icon: Activity, tab: true },
  ] },
  { href: "/learn", key: "learn", title: "About the science", icon: BookOpenText, hint: "Who this helps, the physics, and the methods and data.", items: [
    { id: "impact", key: "impact", label: "Who it helps", icon: Users },
    { id: "science", key: "science", label: "The physics", icon: Microscope },
    { id: "methods", key: "methods", label: "Methods & data", icon: FileText },
  ] },
];

/** The name of a page or section in the chosen language. English uses the wording above; the other
 *  languages use their translated menu entry, which was written for the nearest earlier name. */
export const navName = (x: { title?: string; label?: string; key: TKey }, language: LanguageCode, t: (k: TKey) => string) =>
  language === "en" ? (x.title ?? x.label ?? t(x.key)) : t(x.key);

export const STORY = "/story";

/** Sections of the Explore page that live inside the place chooser, which is folded away until asked for. */
export const PLACE_SECTIONS = ["places", "live", "globe"];

export const pageOf = (pathname: string) => PAGES.find((p) => p.href === pathname) ?? null;
