import type { LeadProfile } from "@forge/shared";

export interface BookingContext {
  leadProfile: LeadProfile;
  contactName: string | null;
  contactEmail: string | null;
}

/**
 * Swappable booking backend. `CalendlyLinkProvider` (Phase 2/3) needs zero
 * credentials — it just builds a prefilled scheduling URL. A future
 * `CalendlyApiProvider` implements the same interface using real API/OAuth
 * credentials for availability lookups and webhook booking confirmation.
 */
export interface BookingProvider {
  buildSchedulingUrl(context: BookingContext): string;
}
