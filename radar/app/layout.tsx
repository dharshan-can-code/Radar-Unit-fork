import type { Metadata, Viewport } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { fontVariables } from "./fonts";

export const metadata: Metadata = {
  title: "DELTA PULSE — Hidden Water",
  description:
    "RADAR UNIT · NASA Space Apps 2026 · Exploring NISAR L-band radar change over wetlands, with transparent uncertainty.",
};

export const viewport: Viewport = { themeColor: "#0b1118", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fontVariables} antialiased`}>{children}</body>
    </html>
  );
}
