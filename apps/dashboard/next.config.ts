import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Next infers the workspace root by walking up for lockfiles, and there's
  // an unrelated package-lock.json in the user's home dir above this
  // monorepo — pin it explicitly so file tracing doesn't get confused.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Prisma's query engine binary is loaded dynamically at runtime (not via a
  // static import/require Next's tracer can follow), so even with the root
  // pinned above it gets silently dropped from the deployed bundle on
  // Vercel — every route touching the database fails with
  // PrismaClientInitializationError. Force-include it everywhere; covers
  // both the standard pnpm symlink and the raw .pnpm store path as a
  // fallback since the exact resolved path can vary by pnpm version.
  outputFileTracingIncludes: {
    "/**/*": [
      "../../node_modules/.prisma/client/**/*",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**/*",
    ],
  },
};

export default nextConfig;
