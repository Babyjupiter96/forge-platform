import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rate-limit";

// The limiter keeps module-level state, so every test uses its own key.
let n = 0;
const freshKey = () => `embed:visitor-${n++}`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("checkRateLimit", () => {
  it("allows the first 20 requests in a window and blocks the 21st", () => {
    const key = freshKey();
    for (let i = 0; i < 20; i++) expect(checkRateLimit(key)).toBe(true);
    expect(checkRateLimit(key)).toBe(false);
    expect(checkRateLimit(key)).toBe(false);
  });

  it("tracks each key independently", () => {
    const a = freshKey();
    const b = freshKey();
    for (let i = 0; i < 20; i++) checkRateLimit(a);
    expect(checkRateLimit(a)).toBe(false);
    expect(checkRateLimit(b)).toBe(true);
  });

  it("stays blocked until the 60 second window has fully elapsed", () => {
    const key = freshKey();
    for (let i = 0; i < 20; i++) checkRateLimit(key);

    vi.advanceTimersByTime(60_000);
    expect(checkRateLimit(key)).toBe(false);

    vi.advanceTimersByTime(1);
    expect(checkRateLimit(key)).toBe(true);
  });

  it("starts a fresh count after the window resets", () => {
    const key = freshKey();
    for (let i = 0; i < 20; i++) checkRateLimit(key);
    vi.advanceTimersByTime(60_001);

    for (let i = 0; i < 20; i++) expect(checkRateLimit(key)).toBe(true);
    expect(checkRateLimit(key)).toBe(false);
  });

  it("does not extend the window on rejected requests", () => {
    const key = freshKey();
    for (let i = 0; i < 20; i++) checkRateLimit(key);
    vi.advanceTimersByTime(30_000);
    expect(checkRateLimit(key)).toBe(false);
    vi.advanceTimersByTime(30_001);
    expect(checkRateLimit(key)).toBe(true);
  });
});
