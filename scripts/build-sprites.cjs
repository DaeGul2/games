/**
 * 스프라이트 자산 빌드 — 원본 픽셀아트 PNG를 게임용으로 가공한다.
 *
 *   assets-src/*.png  (원본, 장당 1~2MB · 저장소에 넣지 않음)
 *        ↓
 *   public/sprites/*.png          게임이 불러오는 실제 파일 (전체 300KB 미만)
 *   src/games/spriteManifest.ts   크기 + 실루엣에서 뽑은 볼록 충돌 도형
 *
 * 하는 일
 *   1) 배경에 깔린 반투명 글로우 제거 (알파 임계값 미만은 버림)
 *   2) 실제 그림 영역으로 크롭
 *   3) 게임 표시 크기에 맞춰 축소 (프리멀티플라이드 박스 평균 — 가장자리 검은 테 방지)
 *   4) 알파 실루엣에서 볼록 껍질을 뽑아 물리 충돌 도형으로 저장
 *
 * 실행: node scripts/build-sprites.cjs
 */
const fs = require('fs');
const path = require('path');
const { decode, encode } = require('./png.cjs');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets-src');
const OUT = path.join(ROOT, 'public', 'sprites');
const MANIFEST = path.join(ROOT, 'src', 'games', 'spriteManifest.ts');

const ALPHA_CUT = 60;   // 이 미만은 배경 글로우로 보고 버린다
const MAX_DIM = 132;    // 게임에서 최대 ~100px로 그리므로 이 정도면 충분
const HULL_PTS = 10;    // Matter가 다루기 좋은 꼭짓점 수
const MIN_FLAT = 0.34;  // 바닥·윗면이 최소 이만큼(스프라이트 폭 대비)은 평평해야 한다
const MAX_CLIP = 0.16;  // 그래도 높이의 이 비율 이상은 깎지 않는다

/** 원본 파일명 → 코드에서 쓸 ASCII 키 (URL·import 안전) */
const KEYS = {
  '10원빵': 'coinbread',
  '김밥': 'gimbap',
  '김치': 'kimchi',
  '떡뽁이': 'tteokbokki',
  '라면': 'ramyeon',
  '만두': 'mandu',
  '불닭': 'buldak',
  '소떡소떡': 'sotteok',
  '양념치킨': 'chicken',
  '컵떡볶이': 'cupteok',
  '컵라면': 'cupramyeon',
  '핫도그': 'hotdog',
};

function stripGlow(img) {
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < ALPHA_CUT) { d[i] = 0; d[i - 1] = 0; d[i - 2] = 0; d[i - 3] = 0; }
  }
}

function bbox(img) {
  const { width: w, height: h, data: d } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

function crop(img, b) {
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    img.data.copy(out, y * w * 4,
      ((y + b.y0) * img.width + b.x0) * 4,
      ((y + b.y0) * img.width + b.x0 + w) * 4);
  }
  return { width: w, height: h, data: out };
}

/** 프리멀티플라이드 박스 평균 — 반투명 가장자리에 검은 테가 생기지 않게 */
function resize(img, tw, th) {
  const { width: sw, height: sh, data: sd } = img;
  const out = Buffer.alloc(tw * th * 4);
  const fx = sw / tw, fy = sh / th;
  for (let y = 0; y < th; y++) {
    const sy0 = Math.floor(y * fy), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < tw; x++) {
      const sx0 = Math.floor(x * fx), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * fx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1 && sy < sh; sy++) {
        for (let sx = sx0; sx < sx1 && sx < sw; sx++) {
          const i = (sy * sw + sx) * 4, sa = sd[i + 3] / 255;
          r += sd[i] * sa; g += sd[i + 1] * sa; b += sd[i + 2] * sa; a += sd[i + 3];
          n++;
        }
      }
      const o = (y * tw + x) * 4;
      if (!n || a === 0) continue;
      const wsum = a / 255;
      out[o] = Math.round(r / wsum);
      out[o + 1] = Math.round(g / wsum);
      out[o + 2] = Math.round(b / wsum);
      out[o + 3] = Math.round(a / n);
    }
  }
  return { width: tw, height: th, data: out };
}

/** 알파 실루엣 → 볼록 껍질 (Andrew monotone chain) */
function hullOf(img, solid = 140) {
  const { width: w, height: h, data: d } = img;
  const pts = [];
  for (let y = 0; y < h; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] >= solid) { if (l < 0) l = x; r = x; }
    if (l >= 0) pts.push([l, y], [r, y]);
  }
  for (let x = 0; x < w; x++) {
    let t = -1, b = -1;
    for (let y = 0; y < h; y++) if (d[(y * w + x) * 4 + 3] >= solid) { if (t < 0) t = y; b = y; }
    if (t >= 0) pts.push([x, t], [x, b]);
  }
  if (pts.length < 3) return null;
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lower = [], upper = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
    lower.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
    upper.push(p);
  }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

/**
 * 반평면(y <= cut 또는 y >= cut)으로 다각형을 자른다 — Sutherland–Hodgman
 */
function clipHalf(poly, cut, keepBelow) {
  const inside = p => (keepBelow ? p[1] <= cut : p[1] >= cut);
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (cut - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, cut]);
    }
  }
  return out;
}

/** 주어진 높이에서 다각형의 가로 폭 */
function widthAt(poly, y) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a[1] - y) * (b[1] - y) > 0) continue;
    if (a[1] === b[1]) { lo = Math.min(lo, a[0], b[0]); hi = Math.max(hi, a[0], b[0]); continue; }
    const t = (y - a[1]) / (b[1] - a[1]);
    const x = a[0] + (b[0] - a[0]) * t;
    lo = Math.min(lo, x); hi = Math.max(hi, x);
  }
  return hi > lo ? hi - lo : 0;
}

/**
 * 바닥과 윗면에 최소한의 평평한 면을 만든다.
 *
 * 원본이 전부 3/4 시점 그림이라 실루엣을 그대로 쓰면 바닥이 둥글어 접점이 한 점뿐이고,
 * 그러면 무엇을 올려도 굴러떨어진다. 폭이 minFlat에 닿을 때까지만 아주 얕게 깎아
 * 실루엣은 그대로 두면서 설 자리를 만들어 준다. (그림이 몇 px 파묻히는 정도로 보인다)
 */
function addFlats(poly, spriteW, minFlatFrac, maxClipFrac, spriteH) {
  const minFlat = spriteW * minFlatFrac;
  const maxClip = spriteH * maxClipFrac;
  let out = poly;

  const ys = out.map(p => p[1]);
  const yMax = Math.max(...ys), yMin = Math.min(...ys);

  // 바닥
  for (let d = 0; d <= maxClip; d += 0.5) {
    const cut = yMax - d;
    if (widthAt(out, cut) >= minFlat || d === Math.floor(maxClip / 0.5) * 0.5) {
      out = clipHalf(out, cut, true);
      break;
    }
  }
  // 윗면
  const ys2 = out.map(p => p[1]);
  const yTop = Math.min(...ys2);
  for (let d = 0; d <= maxClip; d += 0.5) {
    const cut = yTop + d;
    if (widthAt(out, cut) >= minFlat || d === Math.floor(maxClip / 0.5) * 0.5) {
      out = clipHalf(out, cut, false);
      break;
    }
  }
  return out;
}

/** 면적 손실이 가장 작은 꼭짓점부터 제거해 점 수를 줄인다 */
function simplify(hull, maxPts) {
  const pts = hull.map(p => [p[0], p[1]]);
  const area = (a, b, c) => Math.abs((b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])) / 2;
  while (pts.length > maxPts) {
    let best = -1, bestA = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const ar = area(pts[(i - 1 + pts.length) % pts.length], pts[i], pts[(i + 1) % pts.length]);
      if (ar < bestA) { bestA = ar; best = i; }
    }
    pts.splice(best, 1);
  }
  return pts;
}

/* ── 실행 ── */
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png')) fs.unlinkSync(path.join(OUT, f));

const entries = [];
for (const file of fs.readdirSync(SRC).filter(f => f.endsWith('.png')).sort()) {
  const ko = path.basename(file, '.png');
  const key = KEYS[ko];
  if (!key) { console.warn(`건너뜀 — 키 매핑 없음: ${ko}`); continue; }

  let img = decode(fs.readFileSync(path.join(SRC, file)));
  stripGlow(img);
  img = crop(img, bbox(img));
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  img = resize(img, Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));

  const hull = hullOf(img);
  if (!hull) throw new Error(`실루엣을 못 찾음: ${ko}`);
  const flat = addFlats(hull, img.width, MIN_FLAT, MAX_CLIP, img.height);
  // 스프라이트 중심 기준 좌표로 — 게임에서는 표시 크기 비율만 곱하면 된다
  const cx = img.width / 2, cy = img.height / 2;
  const poly = simplify(flat, HULL_PTS).map(([x, y]) => [
    +(x - cx).toFixed(1), +(y - cy).toFixed(1),
  ]);
  const flatBottom = widthAt(poly, Math.max(...poly.map(p => p[1])));

  const buf = encode(img);
  fs.writeFileSync(path.join(OUT, key + '.png'), buf);
  entries.push({ key, ko, w: img.width, h: img.height, poly, bytes: buf.length });
  console.log(
    `${ko.padEnd(9)} → ${key.padEnd(11)} ${img.width}x${img.height}`.padEnd(38),
    `${(buf.length/1024).toFixed(0)}KB`.padStart(6),
    `평평한 바닥 ${flatBottom.toFixed(0)}px (폭의 ${(flatBottom/img.width*100).toFixed(0)}%)`,
  );
}

const total = entries.reduce((s, e) => s + e.bytes, 0);
console.log(`\n${entries.length}개 · ${(total / 1024).toFixed(0)}KB`);

const ts = `/**
 * 스프라이트 메타데이터 — \`node scripts/build-sprites.cjs\`가 생성합니다. 직접 고치지 마세요.
 *
 * poly는 스프라이트 중심을 원점으로 한 볼록 껍질입니다. 원본 알파 실루엣에서 뽑았으므로
 * 게임에서 그리는 크기 비율만 곱하면 그림과 물리 도형이 정확히 일치합니다.
 */
export interface SpriteMeta {
  /** 한글 이름 — 화면 표시용 */
  ko: string;
  /** 원본 픽셀 크기 */
  w: number;
  h: number;
  /** 중심 기준 볼록 껍질 (원본 픽셀 단위) */
  poly: [number, number][];
}

export type SpriteKey =
${entries.map(e => `  | '${e.key}'`).join('\n')};

export const SPRITES: Record<SpriteKey, SpriteMeta> = {
${entries.map(e => `  ${e.key}: {
    ko: '${e.ko}',
    w: ${e.w},
    h: ${e.h},
    poly: [${e.poly.map(p => `[${p[0]}, ${p[1]}]`).join(', ')}],
  },`).join('\n')}
};

export const SPRITE_KEYS = Object.keys(SPRITES) as SpriteKey[];
`;
fs.writeFileSync(MANIFEST, ts, 'utf8');
console.log('매니페스트:', path.relative(ROOT, MANIFEST));
