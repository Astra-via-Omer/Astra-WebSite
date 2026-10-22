// Names are presentation only. Access decisions and PDF watermarks continue to
// use the verified account, approval, membership and document grant.
export function investorDisplayName(email: string, metadata: Record<string, unknown> = {}) {
  for (const key of ['astra_investor_name', 'full_name', 'name', 'display_name']) {
    const value = metadata[key];
    if (typeof value === 'string') {
      const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
      if (clean) return clean;
    }
  }
  const local = email.split('@')[0].replace(/[._+-]+/g, ' ').trim();
  return local ? local.replace(/(^|\s)\p{L}/gu, letter => letter.toLocaleUpperCase()) : 'Investor';
}

export function investorInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase();
}
