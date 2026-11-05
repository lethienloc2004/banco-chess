/** SVG rendering of chess and xiangqi boards. */
import type { Match } from '../game';
import { chessPiece, fxBurst, hasSkin, skinDefs, skinFx, xqPiece } from './skins';

export interface BoardView {
  flipped: boolean;
  selected: number | null;
  /** Destination square → true when the move captures. */
  targets: Map<number, boolean>;
  labels: 'hanzi' | 'viet';
  river: [string, string];
  /** Show the real identity of face-down pieces (admin replay). */
  peek?: boolean;
  /** Arrows drawn over the pieces (e.g. the best move in analysis). */
  arrows?: { from: number; to: number; kind: 'best' | 'played' }[];
  /** Piece skin of each side (White/Red, Black); null = the colour theme. */
  skins?: [string | null, string | null];
}

const NS = 'http://www.w3.org/2000/svg';
const CHESS_GLYPH = ['', '♟', '♞', '♝', '♜', '♛', '♚'];
const HANZI = [
  ['', '帥', '仕', '相', '傌', '俥', '炮', '兵'],
  ['', '將', '士', '象', '馬', '車', '砲', '卒'],
];
const VIET = [
  ['', 'Tướng', 'Sĩ', 'Tượng', 'Mã', 'Xe', 'Pháo', 'Binh'],
  ['', 'Tướng', 'Sĩ', 'Tượng', 'Mã', 'Xe', 'Pháo', 'Tốt'],
];

export const S = 100; // cell size in SVG units
const M = 70; // xiangqi margin

export function chessGlyph(type: number): string {
  return CHESS_GLYPH[type] + '︎';
}

export function xiangqiLabel(type: number, color: number, labels: 'hanzi' | 'viet'): string {
  return (labels === 'hanzi' ? HANZI : VIET)[color][type];
}

export class BoardRenderer {
  readonly svg: SVGSVGElement;
  private match!: Match;
  private view!: BoardView;
  private prevCount: number | null = null;

  constructor(parent: HTMLElement, onCell: (sq: number) => void) {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('board');
    this.svg.setAttribute('role', 'img');
    parent.appendChild(this.svg);
    this.svg.addEventListener('pointerdown', e => {
      const sq = this.cellAtPoint(e.clientX, e.clientY);
      if (sq !== null) onCell(sq);
    });
  }

  /** Centre of a cell in SVG coordinates. */
  center(sq: number): [number, number] {
    const { file, rank } = this.match.cellOf(sq);
    const w = this.match.width, h = this.match.height;
    const fx = this.view.flipped ? w - 1 - file : file;
    const fy = this.view.flipped ? rank : h - 1 - rank;
    return this.match.isChess ? [fx * S + S / 2, fy * S + S / 2] : [M + fx * S, M + fy * S];
  }

  private cellAtPoint(clientX: number, clientY: number): number | null {
    const ctm = this.svg.getScreenCTM();
    if (!ctm || !this.match) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const w = this.match.width, h = this.match.height;
    let fx: number, fy: number;
    if (this.match.isChess) {
      fx = Math.floor(pt.x / S); fy = Math.floor(pt.y / S);
    } else {
      fx = Math.round((pt.x - M) / S); fy = Math.round((pt.y - M) / S);
    }
    if (fx < 0 || fy < 0 || fx >= w || fy >= h) return null;
    const file = this.view.flipped ? w - 1 - fx : fx;
    const rank = this.view.flipped ? fy : h - 1 - fy;
    return this.match.sqOf({ file, rank });
  }

  render(match: Match, view: BoardView, animate = false, intro = false) {
    this.match = match;
    this.view = view;
    const parts: string[] = [];
    const skins = view.skins ?? [null, null];
    parts.push(skinDefs(skins));
    if (match.isChess) this.chessBoard(parts);
    else this.xiangqiBoard(parts);

    const last = match.lastMove();
    const check = match.checkedKing();
    const svgW = match.isChess ? 8 * S : 8 * S + 2 * M;
    const svgH = match.isChess ? 8 * S : 9 * S + 2 * M;
    this.svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);
    this.svg.dataset.kind = match.kind;

    // Highlights under pieces.
    if (last !== null) {
      for (const sq of [match.moveFrom(last), match.moveTo(last)]) {
        const [x, y] = this.center(sq);
        parts.push(match.isChess
          ? `<rect class="hl-last" x="${x - S / 2}" y="${y - S / 2}" width="${S}" height="${S}"/>`
          : `<circle class="hl-last" cx="${x}" cy="${y}" r="47"/>`);
      }
    }
    if (view.selected !== null) {
      const [x, y] = this.center(view.selected);
      parts.push(match.isChess
        ? `<rect class="hl-sel" x="${x - S / 2}" y="${y - S / 2}" width="${S}" height="${S}"/>`
        : `<circle class="hl-sel" cx="${x}" cy="${y}" r="49"/>`);
    }
    if (check !== null) {
      const [x, y] = this.center(check);
      parts.push(`<circle class="hl-check" cx="${x}" cy="${y}" r="${match.isChess ? 46 : 52}"/>`);
    }

    let index = 0;
    for (const p of match.pieces()) {
      const [x, y] = this.center(p.sq);
      // Inner group carries the entrance animation so it doesn't fight the position transform.
      parts.push(`<g class="piece" data-sq="${p.sq}" transform="translate(${x} ${y})"><g class="pi" style="--i:${index++}">`);
      if (match.isChess && p.hidden && !view.peek) {
        // Hidden chess: a face-down disc with the owner's colour on the rim.
        parts.push(`<circle class="cp-disc ${p.color ? 'b' : 'w'}" r="38"/>`,
          `<circle class="cp-ring" r="30"/>`,
          `<text class="cp-q ${p.color ? 'b' : 'w'}" y="2">?</text>`);
      } else if (match.isChess) {
        const sk = skins[p.color];
        parts.push(hasSkin(sk)
          ? chessPiece(sk, p.color as 0 | 1, p.type, p.hidden)
          : `<text class="cp ${p.color ? 'b' : 'w'}${p.hidden ? ' peek' : ''}" y="4">${chessGlyph(p.type)}</text>`);
      } else if (p.hidden && !view.peek) {
        parts.push(`<circle class="xq-disc hidden ${p.color ? 'b' : 'r'}" r="44"/>`,
          `<circle class="xq-ring hidden" r="36"/>`,
          `<text class="xq-q" y="2">?</text>`);
      } else {
        const label = xiangqiLabel(p.type, p.color, view.labels);
        const viet = view.labels === 'viet';
        const sk = skins[p.color];
        if (hasSkin(sk)) {
          parts.push(xqPiece(sk, p.color as 0 | 1, label, `xq-t ${p.color ? 'b' : 'r'}${viet ? ' viet' : ''}${viet && label.length > 3 ? ' long' : ''}`, viet ? 2 : 3, p.hidden));
          parts.push('</g></g>');
          continue;
        }
        parts.push(`<circle class="xq-disc ${p.color ? 'b' : 'r'}${p.hidden ? ' peek' : ''}" r="44"/>`,
          `<circle class="xq-ring ${p.color ? 'b' : 'r'}" r="37"/>`,
          `<text class="xq-t ${p.color ? 'b' : 'r'}${viet ? ' viet' : ''}${viet && label.length > 3 ? ' long' : ''}" y="${viet ? 2 : 3}">${label}</text>`);
      }
      parts.push('</g></g>');
    }

    for (const a of view.arrows ?? []) {
      const [x1, y1] = this.center(a.from), [x2, y2] = this.center(a.to);
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
      // Stop short of the target centre so the head sits on the square.
      const ex = x2 - ux * 22, ey = y2 - uy * 22;
      const head = 26, w = 18;
      parts.push(`<g class="arrow ${a.kind}"><line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}"/>`,
        `<polygon points="${x2},${y2} ${ex - uy * w},${ey + ux * w} ${ex + uy * w},${ey - ux * w}" transform="translate(${ux * (head - 22)} ${uy * (head - 22)})"/></g>`);
    }

    for (const [sq, capture] of view.targets) {
      const [x, y] = this.center(sq);
      parts.push(capture
        ? `<circle class="target cap" cx="${x}" cy="${y}" r="${match.isChess ? 44 : 47}"/>`
        : `<circle class="target" cx="${x}" cy="${y}" r="${match.isChess ? 15 : 13}"/>`);
    }

    // A capture by a skinned piece gets its burst (fire, petals, snow…).
    const count = match.pieces().length;
    if (animate && last !== null && this.prevCount !== null && count < this.prevCount) {
      const mover = match.pieceAt(match.moveTo(last));
      const fx = mover ? skinFx(skins[mover.color]) : null;
      if (fx) {
        const [x, y] = this.center(match.moveTo(last));
        parts.push(fxBurst(fx, x, y));
      }
    }
    this.prevCount = count;

    this.svg.innerHTML = parts.join('');
    if (intro) {
      this.svg.classList.remove('intro');
      void this.svg.getBoundingClientRect();
      this.svg.classList.add('intro');
      window.setTimeout(() => this.svg.classList.remove('intro'), 1200);
    }

    if (animate && last !== null) {
      const from = this.center(match.moveFrom(last));
      const to = this.center(match.moveTo(last));
      const g = this.svg.querySelector<SVGGElement>(`g.piece[data-sq="${match.moveTo(last)}"]`);
      if (g) {
        g.setAttribute('transform', `translate(${from[0]} ${from[1]})`);
        g.classList.add('moving');
        const start = performance.now(), dur = 160;
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / dur);
          const e = 1 - (1 - t) * (1 - t);
          g.setAttribute('transform', `translate(${from[0] + (to[0] - from[0]) * e} ${from[1] + (to[1] - from[1]) * e})`);
          if (t < 1) requestAnimationFrame(step); else g.classList.remove('moving');
        };
        requestAnimationFrame(step);
      }
    }
  }

  private chessBoard(parts: string[]) {
    for (let fy = 0; fy < 8; fy++) {
      for (let fx = 0; fx < 8; fx++) {
        parts.push(`<rect class="${(fx + fy) % 2 ? 'sq-dark' : 'sq-light'}" x="${fx * S}" y="${fy * S}" width="${S}" height="${S}"/>`);
      }
    }
    // Coordinates.
    for (let i = 0; i < 8; i++) {
      const file = this.view.flipped ? 7 - i : i;
      const rank = this.view.flipped ? i + 1 : 8 - i;
      parts.push(`<text class="coord ${i % 2 ? 'on-light' : 'on-dark'}" x="${i * S + S - 6}" y="${8 * S - 7}" text-anchor="end">${'abcdefgh'[file]}</text>`);
      parts.push(`<text class="coord ${i % 2 ? 'on-dark' : 'on-light'}" x="6" y="${i * S + 22}">${rank}</text>`);
    }
  }

  private xiangqiBoard(parts: string[]) {
    const x0 = M, y0 = M, x1 = M + 8 * S, y1 = M + 9 * S;
    parts.push(`<rect class="xq-bg" x="0" y="0" width="${x1 + M}" height="${y1 + M}" rx="14"/>`);
    parts.push(`<rect class="xq-frame" x="${x0 - 10}" y="${y0 - 10}" width="${8 * S + 20}" height="${9 * S + 20}"/>`);
    const lines: string[] = [];
    for (let r = 0; r < 10; r++) lines.push(`M${x0} ${y0 + r * S}H${x1}`);
    for (let f = 0; f < 9; f++) {
      const x = x0 + f * S;
      if (f === 0 || f === 8) lines.push(`M${x} ${y0}V${y1}`);
      else lines.push(`M${x} ${y0}V${y0 + 4 * S}`, `M${x} ${y0 + 5 * S}V${y1}`);
    }
    // Palaces.
    for (const top of [y0, y0 + 7 * S]) {
      lines.push(`M${x0 + 3 * S} ${top}L${x0 + 5 * S} ${top + 2 * S}`, `M${x0 + 5 * S} ${top}L${x0 + 3 * S} ${top + 2 * S}`);
    }
    // Position marks for cannons and soldiers.
    const marks: [number, number][] = [[1, 2], [7, 2], [0, 3], [2, 3], [4, 3], [6, 3], [8, 3]];
    for (const [f, r] of marks) {
      for (const rr of [r, 9 - r]) {
        const cx = x0 + f * S, cy = y0 + rr * S, d = 8, l = 18;
        for (const sx of [-1, 1]) {
          if ((f === 0 && sx < 0) || (f === 8 && sx > 0)) continue;
          for (const sy of [-1, 1]) {
            lines.push(`M${cx + sx * (d + l)} ${cy + sy * d}H${cx + sx * d}V${cy + sy * (d + l)}`);
          }
        }
      }
    }
    parts.push(`<path class="xq-lines" d="${lines.join('')}"/>`);
    const ry = y0 + 4.5 * S;
    parts.push(`<text class="xq-river" x="${x0 + 2 * S}" y="${ry}">${this.view.river[0]}</text>`);
    parts.push(`<text class="xq-river" x="${x0 + 6 * S}" y="${ry}">${this.view.river[1]}</text>`);
  }
}
