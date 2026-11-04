/** Modal dialogs and toasts with enter/leave animations. */

export interface DialogAction {
  label: string;
  kind?: 'primary' | 'ghost';
  onClick?: () => void;
}

export interface DialogOptions {
  title: string;
  body?: string | HTMLElement;
  actions?: DialogAction[];
  className?: string;
  icon?: string;
  onClose?: () => void;
}

export function openDialog(o: DialogOptions): () => void {
  const d = document.createElement('dialog');
  d.className = 'dlg ' + (o.className ?? '');
  d.innerHTML = `
    ${o.icon ? `<div class="dlg-icon" aria-hidden="true">${o.icon}</div>` : ''}
    <h2 class="dlg-title"></h2>
    <div class="dlg-body"></div>
    <div class="dlg-actions"></div>`;
  d.querySelector('.dlg-title')!.textContent = o.title;
  const body = d.querySelector('.dlg-body')!;
  if (typeof o.body === 'string') body.textContent = o.body;
  else if (o.body) body.appendChild(o.body);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    d.classList.add('closing');
    window.setTimeout(() => { d.close(); d.remove(); o.onClose?.(); }, 170);
  };
  const actions = d.querySelector('.dlg-actions')!;
  for (const a of o.actions ?? []) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (a.kind === 'primary' ? ' primary' : a.kind === 'ghost' ? ' ghost' : '');
    b.textContent = a.label;
    b.onclick = () => { close(); a.onClick?.(); };
    actions.appendChild(b);
  }
  d.addEventListener('cancel', e => { e.preventDefault(); close(); });
  d.addEventListener('click', e => { if (e.target === d) close(); }); // backdrop click
  document.body.appendChild(d);
  d.showModal();
  return close;
}

export function confirmDialog(title: string, ok: string, cancel: string): Promise<boolean> {
  return new Promise(resolve => {
    let answered = false;
    openDialog({
      title,
      actions: [
        { label: cancel, kind: 'ghost', onClick: () => { answered = true; resolve(false); } },
        { label: ok, kind: 'primary', onClick: () => { answered = true; resolve(true); } },
      ],
      onClose: () => { if (!answered) resolve(false); },
    });
  });
}

let toastTimer = 0;
export function toast(msg: string) {
  let el = document.querySelector<HTMLElement>('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2200);
}
