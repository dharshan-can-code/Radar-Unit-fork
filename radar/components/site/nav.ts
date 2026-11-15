// The site's pages and what is on each, in reading order. The sidebar, the top bar menu
// and the "next page" link at the foot of each page all read from here.
import type { ComponentType } from "react";
import {
  Activity, CalendarDays, Droplets, FileText, Fingerprint, FlaskConical, Globe2, Map as MapIcon,
  Microscope, Radar, Search, ShieldCheck, Users, Waves,
} from "lucide-react";

export type Icon = ComponentType<{ size?: number; className?: string }>;

/** A place on a page: a section id on that page, or (tab) a tool in the Live and lab tabs. */
export interface NavItem { id: string; label: string; icon: Icon; tab?: boolean }
export interface NavPage { href: string; title: string; items: NavItem[] }

export const PAGES: NavPage[] = [
  { href: "/", title: "Start here", items: [
    { id: "how", label: "How it works", icon: Radar },
    { id: "findings", label: "Findings", icon: Droplets },
  ] },
  { href: "/explore", title: "Explore the data", items: [
    { id: "explorer", label: "Map", icon: MapIcon },
    { id: "fingerprint", label: "What changed", icon: Fingerprint },
    { id: "checks", label: "Is it real?", icon: ShieldCheck },
    { id: "live", label: "Search a place", icon: Search },
    { id: "globe", label: "Globe", icon: Globe2 },
  ] },
  { href: "/lab", title: "Live and lab", items: [
    { id: "now", label: "Water now", icon: Waves, tab: true },
    { id: "scatter", label: "Scatter Lab", icon: Activity, tab: true },
    { id: "lab", label: "Radar Lab", icon: FlaskConical, tab: true },
    { id: "timeline", label: "Every pass", icon: CalendarDays, tab: true },
  ] },
  { href: "/learn", title: "Learn more", items: [
    { id: "impact", label: "Who it helps", icon: Users },
    { id: "science", label: "The physics", icon: Microscope },
    { id: "methods", label: "Methods & data", icon: FileText },
  ] },
];

export const STORY = "/story";

export const pageOf = (pathname: string) => PAGES.find((p) => p.href === pathname) ?? null;
