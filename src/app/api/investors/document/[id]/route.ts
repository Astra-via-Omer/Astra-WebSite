import { context, deliverDocument, errorResponse, privateHeaders } from '@/investors/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await context(request); const { id } = await params;
    const download = new URL(request.url).searchParams.get('download') === '1';
    const document = await deliverDocument(ctx, id, download);
    return new Response(new Uint8Array(document.bytes), { headers: { ...privateHeaders, 'Content-Type': 'application/pdf', 'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${document.name}"` } });
  } catch (error) { return errorResponse(error); }
}
