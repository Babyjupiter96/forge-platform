import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server (`vite`) serves index.html as a normal page for local iteration.
// Production build (`vite build`) bundles src/main.tsx as a single IIFE so a
// host site can drop it in with a plain <script> tag — no module loader,
// no separate CSS file, no dependency on the host page's build tooling.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
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
