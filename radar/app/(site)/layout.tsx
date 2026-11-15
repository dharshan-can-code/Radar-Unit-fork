import SiteShell from "@/components/site/SiteShell";

// One layout for every page of the app, so the data on screen survives moving between them.
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SiteShell>{children}</SiteShell>;
}
