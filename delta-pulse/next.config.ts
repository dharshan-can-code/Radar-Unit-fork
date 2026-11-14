import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // This folder is the project root (silences the multiple-lockfile warning).
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
