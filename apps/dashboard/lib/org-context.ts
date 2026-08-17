import { prisma, type Site } from "@forge/db";

export class SiteNotFoundError extends Error {}
export class OriginNotAllowedError extends Error {}

/**
 * Resolves the public-facing trust boundary for the widget API: an
 * `embedKey` (safe to expose in a <script> tag) plus the request's Origin
 * header, validated server-side against the Site's allowlist. This is the
 * ONE legitimate unscoped read in the app — the caller has no org context
 * until this resolves. Every subsequent DB call for the request must use
 * `forOrg(site.orgId)`.
 *
 * Bad/inactive embedKey -> SiteNotFoundError (404, no info leak about
 * which keys exist). Valid key, disallowed origin -> OriginNotAllowedError
 * (403).
 */
export async function resolveSite(embedKey: string | null, origin: string | null): Promise<Site> {
  if (!embedKey) throw new SiteNotFoundError();

  const site = await prisma.site.findUnique({ where: { embedKey } });
  if (!site || !site.isActive) throw new SiteNotFoundError();

  if (!origin || !site.allowedOrigins.includes(origin)) {
    throw new OriginNotAllowedError();
  }

  return site;
}
