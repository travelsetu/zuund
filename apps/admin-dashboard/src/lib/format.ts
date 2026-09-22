const dateFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const dayFmt = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateFmt.format(d);
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dayFmt.format(d);
}

/** Paise → "₹500" / "₹1,250.50". */
export function fmtPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '—';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : '—';
}

/** "WITHIN_30_DAYS" → "Within 30 days". */
export function humanize(v: string | null | undefined): string {
  if (!v) return '—';
  const s = v.toLowerCase().replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
