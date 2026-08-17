import type { BookingContext, BookingProvider } from "../provider";

/**
 * Placeholder for full Calendly API integration (availability reads,
 * webhook booking-confirmation back into the CRM). Requires a Calendly
 * API key/OAuth app that hasn't been provisioned yet — see Phase 3.
 * Exists now so the BookingProvider interface boundary is exercised by
 * more than one implementation.
 */
export class CalendlyApiProvider implements BookingProvider {
  buildSchedulingUrl(_context: BookingContext): string {
    throw new Error("CALENDLY_API not yet configured — see Phase 3");
  }
}
