import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { fontVariables } from "./fonts";
import { THEME_BOOT_SCRIPT } from "@/lib/themeBoot";

export const metadata: Metadata = {
  title: "DELTA PULSE — Hidden Water",
  description:
    "RADAR UNIT · NASA Space Apps 2026 · Exploring NISAR L-band radar change over wetlands, with transparent uncertainty.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F9FC" },
    { media: "(prefers-color-scheme: dark)", color: "#10142A" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* apply the saved light/dark choice before first paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className={`${fontVariables} antialiased`}>{children}</body>
    </html>
  );
}
