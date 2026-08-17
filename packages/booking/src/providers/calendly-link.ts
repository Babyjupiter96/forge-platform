import type { BookingContext, BookingProvider } from "../provider";

/**
 * Calendly's public scheduling page accepts prefill query params
 * (name, email, and custom a1/a2/... question answers) with no API
 * credentials at all. This is the only booking implementation wired up
 * in Phase 2 — full API-based availability/webhooks is a later provider
 * implementing the same interface.
 */
export class CalendlyLinkProvider implements BookingProvider {
  constructor(private readonly schedulingUrl: string) {}

  buildSchedulingUrl(context: BookingContext): string {
    const url = new URL(this.schedulingUrl);
    if (context.contactName) url.searchParams.set("name", context.contactName);
    if (context.contactEmail) url.searchParams.set("email", context.contactEmail);
    if (context.leadProfile.businessType) {
      url.searchParams.set("a1", context.leadProfile.businessType);
    }
    return url.toString();
  }
}
