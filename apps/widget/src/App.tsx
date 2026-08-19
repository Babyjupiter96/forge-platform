import { useCallback, useEffect, useRef, useState } from "react";
import type { WidgetConfigResponse } from "@forge/shared";
import { fetchWidgetConfig, postChatMessage, type LeadStatus } from "./api";
import { DEFAULT_THEME, themeToCssVars } from "./theme";

interface AppProps {
  embedKey: string;
  baseUrl: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function getOrCreateVisitorId(embedKey: string): string {
  const storageKey = `forge-widget-visitor-${embedKey}`;
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(storageKey, id);
    return id;
  } catch {
    // Storage unavailable (private browsing, etc.) — a fresh id per session is fine.
    return crypto.randomUUID();
  }
}

const LauncherIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M4 12C4 7.58 7.8 4 12.5 4S21 7.58 21 12s-3.8 8-8.5 8c-1.02 0-2-.17-2.9-.48L5 21l1.3-3.9C4.86 15.7 4 13.94 4 12Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);

export default function App({ embedKey, baseUrl }: AppProps) {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [config, setConfig] = useState<WidgetConfigResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lead, setLead] = useState<{ status: LeadStatus; bookingUrl: string | null } | null>(null);

  const conversationIdRef = useRef<string | undefined>(undefined);
  const visitorIdRef = useRef<string>(getOrCreateVisitorId(embedKey));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWidgetConfig(baseUrl, embedKey)
      .then((cfg) => {
        if (cancelled) return;
        setConfig(cfg);
        setTheme(cfg.theme);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load chat right now.");
      });
    return () => {
      cancelled = true;
    };
  }, [baseUrl, embedKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, open]);

  const handleOpen = useCallback(() => {
    setOpen(true);
    setMessages((prev) => (config && prev.length === 0 ? [{ role: "assistant", content: config.greeting }] : prev));
  }, [config]);

  // Lets other elements on the host page (e.g. a hero mascot/graphic) open
  // the widget without any direct coupling — they just dispatch this event
  // on `document`. No-op if nothing ever fires it.
  useEffect(() => {
    document.addEventListener("forge-widget:open", handleOpen);
    return () => document.removeEventListener("forge-widget:open", handleOpen);
  }, [handleOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await postChatMessage(baseUrl, {
        embedKey,
        visitorId: visitorIdRef.current,
        conversationId: conversationIdRef.current,
        message: text,
      });
      conversationIdRef.current = res.conversationId;
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      setLead({ status: res.lead.status, bookingUrl: res.lead.bookingUrl });
    } catch {
      setError("That didn't send — try again?");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="fw-root" style={themeToCssVars(theme)}>
      {open ? (
        <div className="fw-panel">
          <div className="fw-header">
            <span className="fw-header-title">{config?.siteName ?? "Chat"}</span>
            <button className="fw-close-btn" onClick={() => setOpen(false)} aria-label="Close chat">
              ×
            </button>
          </div>

          <div className="fw-messages">
            {messages.map((m, i) => (
              <div key={i} className={`fw-msg fw-msg--${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && <div className="fw-msg fw-msg--assistant fw-msg--typing">…</div>}
            {error && <div className="fw-error">{error}</div>}
            <div ref={messagesEndRef} />
          </div>

          {lead?.status === "QUALIFIED" && lead.bookingUrl && (
            <a className="fw-cta" href={lead.bookingUrl} target="_blank" rel="noopener noreferrer">
              {config?.ctaLabel ?? "Book a call"}
            </a>
          )}

          <div className="fw-input-row">
            <textarea
              className="fw-textarea"
              value={input}
              placeholder="Type a message…"
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="fw-send-btn"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
        </div>
      ) : (
        <button className="fw-launcher" onClick={handleOpen} aria-label="Open chat">
          <LauncherIcon />
        </button>
      )}
    </div>
  );
}
