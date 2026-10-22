'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseRegion, REGION_COOKIE } from '@/regional/policy';

export async function chooseRegion(form: FormData) {
  const region = parseRegion(form.get('region'));
  if (!region) return;
  const jar = await cookies();
  jar.set(REGION_COOKIE, region, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 180 });
  redirect('/privacy');
}

export async function useConnectionRegion() {
  (await cookies()).delete(REGION_COOKIE);
  redirect('/privacy');
}
