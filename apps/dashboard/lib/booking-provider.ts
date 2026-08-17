import { CalendlyLinkProvider, CalendlyApiProvider, type BookingProvider } from "@forge/booking";
import type { ScopedPrismaClient } from "@forge/db";

/**
 * Looks up the org's active BookingIntegration and constructs the matching
 * provider. Returns null if no active integration exists yet (booking
 * link generation is skipped, not an error — a lead can still be scored
 * QUALIFIED without a booking provider configured).
 */
export async function getBookingProvider(db: ScopedPrismaClient, orgId: string): Promise<BookingProvider | null> {
  const integration = await db.bookingIntegration.findFirst({
    where: { orgId, isActive: true },
  });
  if (!integration) return null;

  const config = integration.config as { schedulingUrl?: string };

  if (integration.provider === "CALENDLY_LINK") {
    if (!config.schedulingUrl) return null;
    return new CalendlyLinkProvider(config.schedulingUrl);
  }

  if (integration.provider === "CALENDLY_API") {
    return new CalendlyApiProvider();
  }

  return null;
}
