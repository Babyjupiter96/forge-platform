import { NextResponse } from "next/server";
import type { PersonaConfig, ThemeTokens, WidgetConfigResponse } from "@forge/shared";
import { resolveSite, SiteNotFoundError, OriginNotAllowedError } from "@/lib/org-context";
import { corsHeaders, preflightResponse } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return preflightResponse(req.headers.get("origin"));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const embedKey = url.searchParams.get("embedKey");
  const origin = req.headers.get("origin");

  try {
    const site = await resolveSite(embedKey, origin);
    const persona = site.personaConfig as unknown as PersonaConfig;

    const body: WidgetConfigResponse = {
      siteName: site.name,
      greeting: site.greeting,
      theme: site.themeTokens as unknown as ThemeTokens,
      ctaLabel: persona.ctaLabel,
    };

    return NextResponse.json(body, { headers: corsHeaders(origin!) });
  } catch (err) {
    if (err instanceof SiteNotFoundError) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (err instanceof OriginNotAllowedError) {
      return NextResponse.json({ error: "origin_not_allowed" }, { status: 403 });
    }
    throw err;
  }
}
