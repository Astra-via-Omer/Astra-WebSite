import { adminState, context, errorResponse, mutate, privateHeaders, roomState, uploadDocument } from '@/investors/server';
import { limitedBody, RoomError } from '@/investors/policy';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const ctx = await context(request); const url = new URL(request.url);
    const offset = Number(url.searchParams.get('offset') || 0);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new RoomError(400, 'Invalid audit page.');
    return Response.json(url.searchParams.get('admin') === '1' ? await adminState(ctx, offset) : await roomState(ctx), { headers: privateHeaders });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const ctx = await context(request);
    if (request.headers.get('content-type')?.startsWith('multipart/form-data')) return Response.json(await uploadDocument(ctx), { headers: privateHeaders });
    let body: Record<string, unknown>;
    try { body = JSON.parse((await limitedBody(request, 40000)).toString('utf8')); } catch (error) { if (error instanceof RoomError) throw error; throw new RoomError(400, 'Invalid request.'); }
    if (!body || Array.isArray(body) || typeof body !== 'object') throw new RoomError(400, 'Invalid request.');
    return Response.json(await mutate(ctx, body), { headers: privateHeaders });
  } catch (error) { return errorResponse(error); }
}
