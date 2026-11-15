// The site's pages and what is on each, in reading order. The sidebar, the top bar menu
// and the "next page" link at the foot of each page all read from here.
import type { ComponentType } from "react";
import {
  Activity, CalendarDays, Compass, Droplets, FileText, Fingerprint, FlaskConical, Map as MapIcon,
  Microscope, Radar, Search, ShieldCheck, Telescope, Users, Waves, BookOpenText,
} from "lucide-react";

export type Icon = ComponentType<{ size?: number; className?: string }>;

/** A place on a page: a section id on that page, or (tab) a tool in the Go deeper tabs. */
export interface NavItem { id: string; label: string; icon: Icon; tab?: boolean }
/** hint: one line saying what the page is for, shown on the "next page" link. */
export interface NavPage { href: string; title: string; icon: Icon; hint: string; items: NavItem[] }

// A first visit reads top to bottom: what this is and one explained result, then a place of your
// own (choose it, read the answer, see it on the map, check the evidence), then the extras.
export const PAGES: NavPage[] = [
  { href: "/", title: "Start here", icon: Compass, hint: "What DELTA PULSE is, and one result explained.", items: [
    { id: "how", label: "How it works", icon: Radar },
    { id: "findings", label: "What we found", icon: Droplets },
  ] },
  { href: "/explore", title: "Explore a place", icon: MapIcon, hint: "Choose any place on Earth and read what the radar saw there.", items: [
    { id: "places", label: "Choose a place", icon: Search },
    { id: "answer", label: "The short answer", icon: Droplets },
    { id: "explorer", label: "The map", icon: MapIcon },
    { id: "fingerprint", label: "The evidence", icon: Fingerprint },
    { id: "checks", label: "Is it real?", icon: ShieldCheck },
  ] },
  { href: "/lab", title: "Go deeper", icon: Telescope, hint: "Today's conditions, every pass on record, and two hands-on labs.", items: [
    { id: "now", label: "Conditions today", icon: Waves, tab: true },
    { id: "timeline", label: "Every pass", icon: CalendarDays, tab: true },
    { id: "lab", label: "Radar Lab", icon: FlaskConical, tab: true },
    { id: "scatter", label: "Scatter Lab", icon: Activity, tab: true },
  ] },
  { href: "/learn", title: "About the science", icon: BookOpenText, hint: "Who this helps, the physics, and the methods and data.", items: [
    { id: "impact", label: "Who it helps", icon: Users },
    { id: "science", label: "The physics", icon: Microscope },
    { id: "methods", label: "Methods & data", icon: FileText },
  ] },
];

/** The name of a page or section as shown in the menus. */
export const navName = (x: { title?: string; label?: string }) => x.title ?? x.label ?? "";

export const STORY = "/story";

/** Sections of the Explore page that live inside the place chooser, which is folded away until asked for. */
export const PLACE_SECTIONS = ["places", "live", "globe"];

export const pageOf = (pathname: string) => PAGES.find((p) => p.href === pathname) ?? null;
