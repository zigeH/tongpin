// 手绘抖动描边的近似：沿圆角矩形/圆的路径采样，按种子化的平滑噪声沿法线偏移。
// 设计稿用 SVG feTurbulence + feDisplacementMap（scale 3.5），这里取 ±1.2px 左右的抖动。

function noise(seed: number) {
  const a = Math.sin(seed * 12.9898) * 43758.5453;
  const p1 = (a - Math.floor(a)) * Math.PI * 2;
  const b = Math.sin(seed * 78.233) * 12543.123;
  const p2 = (b - Math.floor(b)) * Math.PI * 2;
  return (t: number) => 0.65 * Math.sin(t * 0.09 + p1) + 0.35 * Math.sin(t * 0.23 + p2);
}

type Pt = [number, number, number, number];

function roundedRectPoints(x: number, y: number, w: number, h: number, r: number, step: number): Pt[] {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const pts: Pt[] = [];
  const line = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.round(len / step));
    for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, nx, ny]);
  };
  const arc = (cx: number, cy: number, a0: number) => {
    const n = Math.max(2, Math.round((Math.PI * r) / 2 / step));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((Math.PI / 2) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
  };
  line(x + r, y, x + w - r, y, 0, -1);
  arc(x + w - r, y + r, -Math.PI / 2);
  line(x + w, y + r, x + w, y + h - r, 1, 0);
  arc(x + w - r, y + h - r, 0);
  line(x + w - r, y + h, x + r, y + h, 0, 1);
  arc(x + r, y + h - r, Math.PI / 2);
  line(x, y + h - r, x, y + r, -1, 0);
  arc(x + r, y + r, Math.PI);
  return pts;
}

function toPath(pts: Pt[], seed: number, amp: number) {
  const n = noise(seed);
  let t = 0;
  const out = pts.map(([px, py, nx, ny], i) => {
    if (i > 0) t += Math.hypot(px - pts[i - 1][0], py - pts[i - 1][1]);
    const d = n(t) * amp;
    return [px + nx * d, py + ny * d];
  });
  return "M" + out.map(([px, py]) => px.toFixed(1) + " " + py.toFixed(1)).join("L") + "Z";
}

export function roughRect(w: number, h: number, r: number, { seed = 7, amp = 1.2, inset = 2 } = {}) {
  return toPath(roundedRectPoints(inset, inset, w - inset * 2, h - inset * 2, r, 6), seed, amp);
}

export function roughCircle(cx: number, cy: number, r: number, { seed = 3, amp = 0.8 } = {}) {
  const n = Math.max(16, Math.round((Math.PI * 2 * r) / 4));
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a), Math.cos(a), Math.sin(a)]);
  }
  return toPath(pts, seed, amp);
}
