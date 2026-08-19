import { createRoot } from "react-dom/client";
import App from "./App";
import { WIDGET_STYLES } from "./styles";

// Deliberately not `document.currentScript` — that's null for module-type
// scripts (our dev server) and unreliable for async-loaded scripts in
// general. A data-attribute lookup works identically in dev and in the
// built IIFE embed.
function findConfigScript(): HTMLScriptElement | null {
  return document.querySelector<HTMLScriptElement>("script[data-forge-embed-key]");
}

function mount() {
  const scriptEl = findConfigScript();
  if (!scriptEl) {
    console.error("[forge-widget] no script tag with data-forge-embed-key found — widget not mounted");
    return;
  }

  const embedKey = scriptEl.dataset.forgeEmbedKey;
  const baseUrl = scriptEl.dataset.forgeBaseUrl;
  if (!embedKey || !baseUrl) {
    console.error("[forge-widget] both data-forge-embed-key and data-forge-base-url are required");
    return;
  }

  const host = document.createElement("div");
  host.id = "forge-widget-host";
  document.body.appendChild(host);

  // Shadow DOM so the host page's CSS can't leak in, and the widget's own
  // styles/markup can't leak out or collide with the host page.
  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = WIDGET_STYLES;
  shadow.appendChild(styleEl);

  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  createRoot(mountPoint).render(<App embedKey={embedKey} baseUrl={baseUrl} />);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mount);
} else {
  mount();
}
