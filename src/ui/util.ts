/** Escape text for safe use inside innerHTML templates. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60;
  if (ms < 10_000 && ms > 0) return `${m}:${String(s).padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function timeAgo(ts: number, lang: 'vi' | 'en'): string {
  const d = Math.max(0, Date.now() - ts) / 1000;
  const units: [number, string, string][] = [[86400, 'ngày', 'd'], [3600, 'giờ', 'h'], [60, 'phút', 'm']];
  for (const [sec, vi, en] of units) if (d >= sec) return lang === 'vi' ? `${Math.floor(d / sec)} ${vi} trước` : `${Math.floor(d / sec)}${en} ago`;
  return lang === 'vi' ? 'vừa xong' : 'just now';
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, html = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (html) e.innerHTML = html;
  return e;
}
