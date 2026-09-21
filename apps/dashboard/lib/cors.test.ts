import { describe, expect, it } from "vitest";
import { corsHeaders, preflightResponse } from "./cors";

describe("corsHeaders", () => {
  it("echoes the specific origin, never a wildcard", () => {
    const headers = corsHeaders("https://client.example") as Record<string, string>;
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://client.example");
  });

  it("sets Vary: Origin so caches don't serve one origin's response to another", () => {
    const headers = corsHeaders("https://client.example") as Record<string, string>;
    expect(headers.Vary).toBe("Origin");
  });

  it("allows only the methods and headers the widget uses", () => {
    const headers = corsHeaders("https://client.example") as Record<string, string>;
    expect(headers["Access-Control-Allow-Methods"]).toBe("GET, POST, OPTIONS");
    expect(headers["Access-Control-Allow-Headers"]).toBe("Content-Type");
  });
});

describe("preflightResponse", () => {
  it("returns 204 with no body", async () => {
    const res = preflightResponse("https://client.example");
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("echoes the requesting origin", () => {
    const res = preflightResponse("https://client.example");
    expect(res.headers.get("access-control-allow-origin")).toBe("https://client.example");
  });

  // Documents current behaviour: a preflight without an Origin header (not
  // something a browser sends) gets a wildcard. The POST handler, not the
  // preflight, is the real security boundary.
  it("falls back to a wildcard when there is no Origin header", () => {
    expect(preflightResponse(null).headers.get("access-control-allow-origin")).toBe("*");
  });
});
