/**
 * Sign in / sign up: Google, or an email address and a 6-digit code sent to
 * it (no password). Signing in with a new email creates the account, keeping
 * the guest's name, rating and games. Only signed-in players play online.
 */
import { ApiError, lobby, net, renderGoogleButton } from '../net';
import { t } from '../state';
import { openDialog, toast } from './dialog';
import { esc } from './util';

/** Fired on window after signing in or out, so open screens can refresh (e.g. take a seat in a room). */
export const ACCOUNT_EVENT = 'banco:account';

export function accountChanged() {
  lobby.restart();
  window.dispatchEvent(new Event(ACCOUNT_EVENT));
}

let openNow: (() => void) | null = null;

/** Open the sign-in dialog. `onDone` runs after a successful sign-in. */
export function openLogin(onDone?: () => void, reason?: string) {
  if (openNow) return;
  const s = t();
  const L = s.login;
  const body = document.createElement('div');
  body.className = 'login-body';
  let email = '';
  let timer = 0;
  let close = () => {};

  const done = () => {
    clearInterval(timer);
    close();
    accountChanged();
    toast(L.welcome(net.me?.name ?? ''));
    onDone?.();
  };

  const errorText = (e: unknown): string => {
    if (!(e instanceof ApiError)) return s.netError;
    const m: Record<string, string> = {
      'bad-email': L.badEmail, 'too-many': L.tooMany, 'send-failed': L.sendFailed, 'email-disabled': L.emailDisabled,
      'bad-code': L.badCode, 'code-expired': L.expired, 'too-many-attempts': L.tooManyAttempts, wait: L.wait,
    };
    return m[e.code] ?? s.netError;
  };

  const emailStep = () => {
    clearInterval(timer);
    const google = !!net.config?.googleClientId;
    const mail = net.config?.emailLogin !== false;
    body.innerHTML = `
      <p class="${reason ? 'login-reason' : 'muted small'}">${esc(reason ?? L.intro)}</p>
      ${google ? `<div class="gbtn"></div>` : ''}
      ${google && mail ? `<div class="or"><span>${esc(L.or)}</span></div>` : ''}
      ${mail ? `<form class="login-form" novalidate>
        <label for="login-email">${esc(L.email)}</label>
        <input id="login-email" class="inp" type="email" inputmode="email" autocomplete="email" maxlength="254" placeholder="ten@gmail.com" value="${esc(email)}" required />
        <p class="login-err" role="alert" hidden></p>
        <button class="btn primary" type="submit">${esc(L.sendCode)}</button>
        <p class="muted small">${esc(L.noPassword)}</p>
      </form>` : ''}
      ${net.config?.dev ? `<button type="button" class="btn ghost" data-act="dev-admin">🛠 ${esc(s.devAdmin)}</button>` : ''}`;
    body.querySelector<HTMLButtonElement>('[data-act="dev-admin"]')?.addEventListener('click', async () => {
      try { await net.loginDevAdmin(); done(); } catch { toast(s.netError); }
    });
    if (google) {
      void renderGoogleButton(body.querySelector('.gbtn')!, async credential => {
        try { await net.loginGoogle(credential); done(); } catch { toast(s.netError); }
      });
    }
    const form = body.querySelector<HTMLFormElement>('.login-form');
    if (!form) return;
    const input = form.querySelector<HTMLInputElement>('input')!;
    const err = form.querySelector<HTMLElement>('.login-err')!;
    const btn = form.querySelector<HTMLButtonElement>('button')!;
    window.setTimeout(() => input.focus(), 50);
    form.onsubmit = async e => {
      e.preventDefault();
      email = input.value.trim();
      err.hidden = true;
      btn.disabled = true;
      try {
        const r = await net.startEmail(email);
        codeStep(r.resendIn, r.devCode);
      } catch (x) {
        err.textContent = errorText(x);
        err.hidden = false;
        btn.disabled = false;
      }
    };
  };

  const codeStep = (resendIn: number, devCode?: string) => {
    body.innerHTML = `
      <p>${L.sentTo(`<b>${esc(email)}</b>`)}</p>
      <p class="muted small">${esc(L.checkSpam)}</p>
      ${devCode ? `<p class="note">🧪 ${esc(L.devCode(devCode))}</p>` : ''}
      <form class="login-form" novalidate>
        <label for="login-code">${esc(L.code)}</label>
        <input id="login-code" class="inp code-inp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" placeholder="••••••" value="${devCode ?? ''}" />
        <p class="login-err" role="alert" hidden></p>
        <button class="btn primary" type="submit">${esc(L.signIn)}</button>
        <div class="login-links"><button type="button" class="link-btn" data-act="resend" disabled></button><button type="button" class="link-btn" data-act="back">${esc(L.changeEmail)}</button></div>
      </form>`;
    const form = body.querySelector<HTMLFormElement>('.login-form')!;
    const input = form.querySelector<HTMLInputElement>('input')!;
    const err = form.querySelector<HTMLElement>('.login-err')!;
    const btn = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const resend = form.querySelector<HTMLButtonElement>('[data-act="resend"]')!;
    window.setTimeout(() => input.focus(), 50);
    let left = resendIn;
    const tickResend = () => {
      resend.disabled = left > 0;
      resend.textContent = left > 0 ? L.resendIn(left) : L.resend;
      left--;
    };
    clearInterval(timer);
    tickResend();
    timer = window.setInterval(tickResend, 1000);
    input.oninput = () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 6);
      if (input.value.length === 6) form.requestSubmit();
    };
    form.onsubmit = async e => {
      e.preventDefault();
      if (input.value.length !== 6) { err.textContent = L.badCode; err.hidden = false; return; }
      err.hidden = true;
      btn.disabled = true;
      try {
        await net.verifyEmail(email, input.value);
        done();
      } catch (x) {
        const tries = x instanceof ApiError && x.code === 'bad-code' ? (x.data.left as number | undefined) : undefined;
        err.textContent = errorText(x) + (tries !== undefined ? ` ${L.triesLeft(tries)}` : '');
        err.hidden = false;
        btn.disabled = false;
        input.select();
        if (x instanceof ApiError && (x.code === 'code-expired' || x.code === 'too-many-attempts')) { left = 0; tickResend(); }
      }
    };
    resend.onclick = async () => {
      resend.disabled = true;
      try {
        const r = await net.startEmail(email);
        left = r.resendIn;
        toast(L.resent);
        if (r.devCode) input.value = r.devCode;
      } catch (x) {
        err.textContent = errorText(x);
        err.hidden = false;
        left = x instanceof ApiError && typeof x.data.retryIn === 'number' ? x.data.retryIn : 30;
      }
    };
    form.querySelector<HTMLButtonElement>('[data-act="back"]')!.onclick = emailStep;
  };

  emailStep();
  close = openDialog({
    title: L.title, icon: '♟', className: 'login-dlg', body,
    actions: [{ label: s.close, kind: 'ghost' }],
    onClose: () => { clearInterval(timer); openNow = null; },
  });
  openNow = close;
}

/** Run `action` if signed in, else ask to sign in first and run it afterwards. */
export function requireMember(action: () => void, reason?: string) {
  if (net.member) action();
  else openLogin(action, reason ?? t().login.needed);
}
