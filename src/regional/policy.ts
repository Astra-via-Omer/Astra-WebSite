export const REGION_COOKIE = 'astra-region';
export const REGIONS = ['international', 'israel', 'eea', 'uk', 'us'] as const;
export type Region = typeof REGIONS[number];
export const REGION_LABELS: Record<Region, string> = {
  international: 'International', israel: 'Israel', eea: 'European Economic Area', uk: 'United Kingdom', us: 'United States',
};
const EEA = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE'.split(' '));

export function parseRegion(value: unknown): Region | null {
  return typeof value === 'string' && REGIONS.includes(value as Region) ? value as Region : null;
}

export function regionForCountry(country: string | null): Region {
  if (country === 'IL') return 'israel';
  if (country === 'US') return 'us';
  if (country === 'GB') return 'uk';
  if (country && EEA.has(country)) return 'eea';
  return 'international';
}

export function resolveRegion(input: { countryHeader: string | null; trustGoogleGeo: boolean; preference?: string }) {
  // Only enable this after the load balancer overwrites this header AND direct ingress is closed.
  const candidate = input.trustGoogleGeo ? input.countryHeader?.trim().toUpperCase() : null;
  const country = candidate && /^[A-Z]{2}$/.test(candidate) && !['ZZ', 'XX'].includes(candidate) ? candidate : null;
  const detected = regionForCountry(country);
  return {
    country,
    detected,
    region: parseRegion(input.preference) ?? detected,
    // A policy selection changes the notice, never the connection estimate or language gate.
    showHebrew: country === 'IL',
  };
}
export type RegionalContext = ReturnType<typeof resolveRegion>;
