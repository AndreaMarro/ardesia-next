/*
SVG geometry from lucide-react 1.63.0; only React reconciliation keys have been removed.
All node data stays in this JavaScript module. Rendering is adapted for this app.

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/
import {createElement, type SVGProps} from 'react';
type IconProps = SVGProps<SVGSVGElement> & {size?: number | string};
type IconNode = string | readonly [string, Readonly<Record<string, string | number>>];
function icon(classes: string, nodes: readonly IconNode[]) {
  return function Icon({size = 24, color = 'currentColor', strokeWidth = 2, className = '', children, ...props}: IconProps) {
    const accessible = Boolean(children) || Object.keys(props).some(name => name.startsWith('aria-') || name === 'role' || name === 'title');
    return createElement('svg', {
      xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: color || 'currentColor', strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
      className: [...new Set((classes + ' ' + className).split(' ').filter(Boolean))].join(' '),
      ...(!accessible && {'aria-hidden': 'true'}), ...props,
    }, nodes.map((node, index) => typeof node === 'string'
      ? createElement('path', {d: node, key: index}) : createElement(node[0], {...node[1], key: index})), children);
  };
}
export const ArrowUpRight = icon("lucide lucide-arrow-up-right", ["M7 7h10v10","M7 17 17 7"]);
export const Check = icon("lucide lucide-check", ["M20 6 9 17l-5-5"]);
export const Download = icon("lucide lucide-download", ["M12 15V3","M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","m7 10 5 5 5-5"]);
export const FlaskConical = icon("lucide lucide-flask-conical", ["M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2","M6.453 15h11.094","M8.5 2h7"]);
export const History = icon("lucide lucide-rotate-ccw-clock lucide-history", ["M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8","M3 3v5h5","M12 7v5l4 2"]);
export const Layers3 = icon("lucide lucide-layers lucide-layers-3", ["M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z","M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12","M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"]);
export const LibraryBig = icon("lucide lucide-library-big", [["rect",{"width":"8","height":"18","x":"3","y":"3","rx":"1"}],"M7 3v18","M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z"]);
export const Link2 = icon("lucide lucide-link-2", ["M9 17H7A5 5 0 0 1 7 7h2","M15 7h2a5 5 0 1 1 0 10h-2",["line",{"x1":"8","x2":"16","y1":"12","y2":"12"}]]);
export const MousePointer2 = icon("lucide lucide-mouse-pointer-2", ["M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"]);
export const NotebookPen = icon("lucide lucide-notebook-pen", ["M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4","M2 6h4","M2 10h4","M2 14h4","M2 18h4","M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"]);
export const Plus = icon("lucide lucide-plus", ["M5 12h14","M12 5v14"]);
export const Power = icon("lucide lucide-power", ["M12 2v10","M18.4 6.6a9 9 0 1 1-12.77.04"]);
export const Save = icon("lucide lucide-save", ["M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z","M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7","M7 3v4a1 1 0 0 0 1 1h7"]);
export const Search = icon("lucide lucide-search", ["m21 21-4.34-4.34",["circle",{"cx":"11","cy":"11","r":"8"}]]);
export const Settings2 = icon("lucide lucide-settings-2", ["M14 17H5","M19 7h-9",["circle",{"cx":"17","cy":"17","r":"3"}],["circle",{"cx":"7","cy":"7","r":"3"}]]);
export const ShieldCheck = icon("lucide lucide-shield-check", ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z","m9 12 2 2 4-4"]);
export const SquareFunction = icon("lucide lucide-square-function lucide-function-square", [["rect",{"width":"18","height":"18","x":"3","y":"3","rx":"2","ry":"2"}],"M9 17c2 0 2.8-1 2.8-2.8V10c0-2 1-3.3 3.2-3","M9 11.2h5.7"]);
export const SquarePen = icon("lucide lucide-square-pen lucide-pen-box lucide-edit lucide-pen-square", ["M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7","M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"]);
export const Trash2 = icon("lucide lucide-trash lucide-trash-2", ["M10 11v6","M14 11v6","M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6","M3 6h18","M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"]);
export const Type = icon("lucide lucide-type", ["M12 4v16","M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2","M9 20h6"]);
export const Undo2 = icon("lucide lucide-undo-2", ["M9 14 4 9l5-5","M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"]);
export const X = icon("lucide lucide-x", ["M18 6 6 18","m6 6 12 12"]);
