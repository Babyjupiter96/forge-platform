import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Next infers the workspace root by walking up for lockfiles, and there's
  // an unrelated package-lock.json in the user's home dir above this
  // monorepo — pin it explicitly so file tracing doesn't get confused.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
