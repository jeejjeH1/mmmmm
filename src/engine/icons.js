// Stroke icons (48x48 viewBox). Colour comes from currentColor.
const wrap = (d, sw = 3.2) => `<svg viewBox="0 0 48 48" class="stroke" stroke="currentColor" stroke-width="${sw}">${d}</svg>`;
export const ICONS = {
  search: wrap('<circle cx="21" cy="21" r="12"/><path d="M30.5 30.5 L40 40"/><path d="M15 21 a6 6 0 0 1 6 -6" opacity=".6"/>'),
  doc: wrap('<path d="M13 5 h15 l8 8 v30 h-23 z"/><path d="M28 5 v8 h8"/><path d="M18.5 22 h12 M18.5 28 h12 M18.5 34 h8"/>'),
  shield: wrap('<path d="M24 4.5 l15 6 v11 c0 10 -6.5 17 -15 21.5 c-8.5 -4.5 -15 -11.5 -15 -21.5 v-11 z"/><path d="M17 24 l5 5 l9 -10"/>'),
  bolt: wrap('<path d="M27 4 L11 27 h12 l-3 17 l17 -24 h-12 z"/>'),
  check: wrap('<path d="M12 25 l8 8 l16 -18"/>', 4.5),
  cross: wrap('<path d="M14 14 L34 34 M34 14 L14 34"/>', 4.5),
  cpu: wrap('<rect x="12" y="12" width="24" height="24" rx="4"/><rect x="19" y="19" width="10" height="10" rx="1.5"/><path d="M18 6 v6 M24 6 v6 M30 6 v6 M18 36 v6 M24 36 v6 M30 36 v6 M6 18 h6 M6 24 h6 M6 30 h6 M36 18 h6 M36 24 h6 M36 30 h6"/>', 2.6),
  users: wrap('<circle cx="18" cy="17" r="6"/><path d="M7 38 c0 -7 5 -11 11 -11 s11 4 11 11"/><circle cx="33" cy="19" r="5"/><path d="M31 28 c6 0 10 3.5 10 10"/>'),
  block: wrap('<path d="M24 5 l16 9 v20 l-16 9 l-16 -9 v-20 z"/><path d="M8 14 l16 9 l16 -9 M24 23 v20"/>'),
  loop: wrap('<path d="M36 18 a13 13 0 1 0 2 9"/><path d="M38 9 v10 h-10"/>'),
  code: wrap('<path d="M17 14 L7 24 L17 34 M31 14 L41 24 L31 34 M27 10 L21 38"/>'),
  memory: wrap('<path d="M10 14 c0 -4 28 -4 28 0 v20 c0 4 -28 4 -28 0 z"/><path d="M10 14 c0 4 28 4 28 0 M10 21 c0 4 28 4 28 0 M10 28 c0 4 28 4 28 0"/>'),
  qa: wrap('<path d="M12 8 h24 v32 h-24 z"/><path d="M17 17 l3 3 l5 -6 M17 27 l3 3 l5 -6 M29 18 h3 M29 28 h3"/>'),
  scale: wrap('<path d="M24 6 v34 M14 40 h20 M10 13 h28"/><path d="M10 13 l-6 13 a6 6 0 0 0 12 0 z M38 13 l-6 13 a6 6 0 0 0 12 0 z"/>'),
};

import { LOGO } from '../logo.js';
const pts = (poly) => poly.map(([x, y]) => `${x},${-y}`).join(' ');
// GenLayer mark as inline SVG; fill can be a colour or url(#gradient).
export function logoSVG(fill = 'currentColor', defs = '') {
  return `<svg viewBox="-190 -180 380 360" xmlns="http://www.w3.org/2000/svg">${defs}<g fill="${fill}"><polygon points="${pts(LOGO.left)}"/><polygon points="${pts(LOGO.right)}"/><polygon points="${pts(LOGO.kite)}"/></g></svg>`;
}
export const LOGO_GRAD = (id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff87ff"/><stop offset="1" stop-color="#dc00ff"/></linearGradient></defs>`;
