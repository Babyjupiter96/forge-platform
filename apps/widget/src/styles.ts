// Injected into the widget's own <style> element inside the shadow root, so
// it's fully isolated from (and can't be broken by) the host page's CSS.
export const WIDGET_STYLES = /* css */ `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600&family=Cinzel:wght@500&family=Jost:wght@400;500&display=swap');

* {
  box-sizing: border-box;
}

.fw-root {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 2147483000;
  font-family: var(--fw-font-body);
  color: var(--fw-ink);
}

.fw-launcher {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: 1px solid var(--fw-rule-strong);
  background: var(--fw-accent);
  color: var(--fw-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  transition: transform 0.15s ease;
}
.fw-launcher:hover {
  transform: scale(1.05);
}
.fw-launcher svg {
  width: 26px;
  height: 26px;
}

.fw-panel {
  width: 360px;
  max-width: calc(100vw - 32px);
  height: 520px;
  max-height: calc(100vh - 48px);
  background: var(--fw-panel);
  border: 1px solid var(--fw-rule);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}

.fw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  background: var(--fw-panel-alt);
  border-bottom: 1px solid var(--fw-rule);
}
.fw-header-title {
  font-family: var(--fw-font-label);
  letter-spacing: 0.04em;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--fw-ink);
}
.fw-close-btn {
  background: transparent;
  border: none;
  color: var(--fw-muted);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
}
.fw-close-btn:hover {
  color: var(--fw-ink);
}

.fw-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.fw-msg {
  max-width: 82%;
  padding: 10px 13px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
}
.fw-msg--assistant {
  align-self: flex-start;
  background: var(--fw-panel-alt);
  border: 1px solid var(--fw-rule);
  color: var(--fw-ink-soft);
  border-bottom-left-radius: 4px;
}
.fw-msg--user {
  align-self: flex-end;
  background: var(--fw-accent);
  color: var(--fw-ink);
  border-bottom-right-radius: 4px;
}
.fw-msg--typing {
  opacity: 0.6;
}

.fw-error {
  align-self: center;
  color: var(--fw-accent);
  font-size: 12px;
  text-align: center;
}

.fw-cta {
  display: block;
  margin: 0 18px 12px;
  padding: 11px 14px;
  text-align: center;
  border-radius: 10px;
  background: var(--fw-steel);
  color: var(--fw-bg);
  font-family: var(--fw-font-label);
  font-size: 12px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-decoration: none;
  font-weight: 600;
}
.fw-cta:hover {
  filter: brightness(1.08);
}

.fw-input-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--fw-rule);
  background: var(--fw-panel-alt);
}

.fw-textarea {
  flex: 1;
  resize: none;
  max-height: 90px;
  min-height: 20px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--fw-ink);
  font-family: var(--fw-font-body);
  font-size: 14px;
  line-height: 1.4;
  padding: 6px 4px;
}
.fw-textarea::placeholder {
  color: var(--fw-muted);
}

.fw-send-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--fw-accent);
  color: var(--fw-ink);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}
.fw-send-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.fw-messages::-webkit-scrollbar {
  width: 6px;
}
.fw-messages::-webkit-scrollbar-thumb {
  background: var(--fw-rule);
  border-radius: 3px;
}
`;
