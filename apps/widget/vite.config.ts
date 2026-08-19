import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server (`vite`) serves index.html as a normal page for local iteration.
// Production build (`vite build`) bundles src/main.tsx as a single IIFE so a
// host site can drop it in with a plain <script> tag — no module loader,
// no separate CSS file, no dependency on the host page's build tooling.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // The build ships as a plain <script> tag on an arbitrary host page with
  // no bundler and no Node `process` global — but React's internals read
  // `process.env.NODE_ENV`. Statically replace it at build time so the
  // output never references `process` at runtime.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: "dist",
    cssCodeSplit: false,
    lib: {
      entry: "src/main.tsx",
      name: "ForgeWidget",
      formats: ["iife"],
      fileName: () => "forge-widget.js",
    },
  },
});
