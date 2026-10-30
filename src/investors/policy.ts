export class RoomError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const categories = ['Company overview', 'Pitch deck', 'Financials', 'Corporate & legal', 'Product & traction', 'Investor updates'] as const;
export const roomRoles = ['investor', 'power_user', 'admin'] as const;
export const roomTabOptions = [['overview', 'Overview'], ['documents', 'Documents'], ['updates', 'Astra updates'], ['questions', 'Questions']] as const;
export const roomRoleLabels: Record<string, string> = { investor: 'Investor', power_user: 'Astra power user', admin: 'Investor administrator' };
export type Member = {
  user_id: string; email: string; role: typeof roomRoles[number]; expires_at: string | null; tab_access?: string[];
  stage: string; nda_version: string | null; nda_sha256?: string | null; organization: string; display_name?: string;
};
export function memberTabs(member: Pick<Member, 'role' | 'tab_access'>): string[] {
  const content = roomTabOptions.map(([key]) => key);
  const tabs = member.role === 'admin' || member.role === 'power_user' ? content : content.filter(key => member.tab_access?.includes(key));
  return [...tabs, 'account', ...(member.role === 'admin' ? ['admin'] : [])];
}
export function tabAccessField(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > roomTabOptions.length || value.some(v => typeof v !== 'string' || !roomTabOptions.some(([key]) => key === v)) || new Set(value).size !== value.length) throw new RoomError(400, 'Choose valid investor tabs.');
  return roomTabOptions.map(([key]) => key).filter(key => value.includes(key));
}
export function assertTab(member: Member, tab: string) {
  if (!memberTabs(member).includes(tab)) throw new RoomError(403, 'This section is not approved for your account.');
}
export type RoomDocument = {
  id: string; title: string; category: string; version: string; description: string;
  object_path: string; sha256: string; pages: number; bytes: number; published: boolean; created_at: string;
};
export function assertMembership(user: { email_confirmed_at?: string; banned_until?: string; app_metadata?: Record<string, unknown> }, approved: boolean, member: Member | null, now = Date.now()) {
  if (!user.email_confirmed_at || user.app_metadata?.disabled === true || user.app_metadata?.disabled === 'true' || user.app_metadata?.directory_archived === true || user.app_metadata?.directory_archived === 'true' ||
      (user.banned_until && Date.parse(user.banned_until) > now) || !approved || !member ||
      !roomRoles.includes(member.role) || (member.expires_at !== null && (!Number.isFinite(Date.parse(member.expires_at)) || Date.parse(member.expires_at) <= now))) {
    throw new RoomError(403, 'Investor room access is not approved, has expired, or has been suspended.');
  }
}
export function assertDocument(member: Member, doc: RoomDocument | null, grant: { can_view: boolean; can_download: boolean } | null, download: boolean) {
  const tabs = memberTabs(member);
  const sectionAllowed = tabs.includes('documents') || (doc?.category === 'Investor updates' && tabs.includes('updates'));
  if (!doc || (member.role !== 'admin' && (!sectionAllowed || !doc.published || (member.role !== 'power_user' && !grant?.can_view) || (download && !grant?.can_download))))
    throw new RoomError(404, 'This document is unavailable for the requested action.');
}
export function textField(value: unknown, max = 200, required = true): string {
  if (typeof value !== 'string' || value.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value) || (required && !value.trim()))
    throw new RoomError(400, 'Check the entered text and its length.');
  return value.trim();
}
export function emailField(value: unknown): string {
  const email = textField(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RoomError(400, 'Enter a valid email address.');
  return email;
}
export function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new RoomError(400, 'Invalid record identifier.');
  return value;
}
export async function limitedBody(request: Request, max: number) {
  if (Number(request.headers.get('content-length')) > max) throw new RoomError(413, 'The request is too large.');
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new RoomError(413, 'The request is too large.'); } chunks.push(value); }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
