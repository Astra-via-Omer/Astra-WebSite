import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { REGION_COOKIE, resolveRegion } from './policy';

export const getRegionalContext = cache(async () => {
  const [requestHeaders, jar] = await Promise.all([headers(), cookies()]);
  return resolveRegion({
    countryHeader: requestHeaders.get('x-astra-client-country'),
    trustGoogleGeo: process.env.ASTRA_TRUST_GOOGLE_GEO === 'true',
    preference: jar.get(REGION_COOKIE)?.value,
  });
});
