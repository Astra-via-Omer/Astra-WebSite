import { errorResponse, privateHeaders, requestPasswordReset } from '@/investors/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try { return Response.json(await requestPasswordReset(request), { headers: privateHeaders }); }
  catch (error) { return errorResponse(error); }
}
