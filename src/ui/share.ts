/** Sharing: the system share sheet on phones, else copy the text and link. */
import { t } from '../state';
import { toast } from './dialog';

/** Full link to a screen of this app (the hash route). */
export const appLink = (hash: string) => location.origin + location.pathname + hash;

export async function share(text: string, url: string) {
  if (navigator.share) {
    try { await navigator.share({ title: 'Bàn Cờ', text, url }); return; }
    catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast(t().shareCopied); }
  catch { toast(url); }
}
