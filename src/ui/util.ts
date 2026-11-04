/** Escape text for safe use inside innerHTML templates. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function formatClock(ms: number): string {
  ms = Math.max(0, ms);
  // Under 10 seconds show tenths (rounded down, so 0:00.0 means the flag has fallen).
  if (ms < 10_000) return `0:0${Math.floor(ms / 1000)}.${Math.floor((ms % 1000) / 100)}`;
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
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
