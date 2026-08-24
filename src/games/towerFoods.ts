/**
 * K-푸드 타워 — 음식 정의
 *
 * 각 음식은 두 가지를 함께 들고 있다.
 *   parts : 물리 엔진에 넘길 **볼록** 도형 조각 (로컬 좌표, 원점 기준)
 *   draw  : 같은 로컬 좌표계에 그리는 그림 (외부 이미지 없음)
 *
 * 실루엣이 곧 물리 특성이다 — 김밥은 원이라 굴러가고, 김치는 밑동이 넓어 안정적이고,
 * 소떡소떡은 길어서 걸치기에 좋다. 밸런스 수치를 따로 조정하지 않고 모양으로 성격을 만든다.
 * (얼굴·눈은 넣지 않는다. 작은 크기에서 실루엣을 잡아먹고 무슨 음식인지 안 읽힌다.)
 */

type Ctx = CanvasRenderingContext2D;
type V = [number, number];

export interface Part {
  /** 볼록 다각형 꼭짓점 (로컬 좌표) */
  verts?: V[];
  /** 원 — 굴림 특성이 필요한 조각 */
  circle?: { x: number; y: number; r: number };
}

export interface FoodDef {
  key: string;
  name: string;
  /** 쌓을 때의 성격 — 안내 문구에 쓴다 */
  desc: string;
  /** 쌓기 난이도. 점수 배수로도 쓰인다 */
  tier: 1 | 2 | 3;
  parts: Part[];
  friction: number;
  frictionStatic: number;
  restitution: number;
  density: number;
  /** 미리보기·고스트 스케일 계산용 */
  bbox: { w: number; h: number };
  draw: (ctx: Ctx, t: number) => void;
}

/* ===== 그리기 도우미 ===== */

function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function rad(c: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][]) {
  const g = c.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}

function poly(c: Ctx, vs: V[]) {
  c.beginPath();
  c.moveTo(vs[0][0], vs[0][1]);
  for (let i = 1; i < vs.length; i++) c.lineTo(vs[i][0], vs[i][1]);
  c.closePath();
}

/** 어두운 배경에서 형태를 띄우는 외곽선 */
function rim(c: Ctx, path: () => void, col = 'rgba(255,255,255,.30)', w = 1.4) {
  c.save();
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineJoin = 'round';
  path();
  c.stroke();
  c.restore();
}

/* ═══════════════════════════════════════════
   1. 호떡 — 넓고 두꺼운 원판. 최고의 받침대
   ═══════════════════════════════════════════ */
const HOTTEOK_V: V[] = [
  [-34, -11], [-22, -17], [22, -17], [34, -11],
  [34, 9], [22, 15], [-22, 15], [-34, 9],
];

/* ═══════════════════════════════════════════
   2. 만두 — 반달. 밑면이 평평해 잘 쌓인다
   ═══════════════════════════════════════════ */
const MANDU_V: V[] = [
  [-28, 11], [-25, -5], [-13, -15], [13, -15], [25, -5], [28, 11],
];

/* ═══════════════════════════════════════════
   4. 가래떡 — 긴 막대. 기둥·다리로 쓰기 좋다
   ═══════════════════════════════════════════ */
const TTEOK_V: V[] = [
  [-42, -8], [-36, -13], [36, -13], [42, -8],
  [42, 8], [36, 13], [-36, 13], [-42, 8],
];

/* ═══════════════════════════════════════════
   5. 붕어빵 — 비대칭 물고기. 꼬리가 걸린다
   ═══════════════════════════════════════════ */
const BUNGEO_BODY: V[] = [
  [-18, -14], [6, -19], [24, -7], [26, 2], [10, 18], [-16, 14],
];
const BUNGEO_TAIL: V[] = [
  [-16, -10], [-30, -16], [-30, 15], [-16, 10],
];

/* ═══════════════════════════════════════════
   6. 김치 — 포기. 밑동이 넓어 가장 안정적
   ═══════════════════════════════════════════ */
const KIMCHI_STEM: V[] = [
  [-26, 4], [26, 4], [22, 27], [-22, 27],
];
const KIMCHI_LEAF: V[] = [
  [-23, 5], [23, 5], [13, -28], [-13, -28],
];

/* ═══════════════════════════════════════════
   7. 계란후라이 — 아주 납작한 판 + 노른자 돌기
   ═══════════════════════════════════════════ */
const EGG_WHITE: V[] = [
  [-40, 3], [-31, -5], [31, -5], [40, 3], [37, 13], [-37, 13],
];

/* ═══════════════════════════════════════════
   8. 닭다리 — 무겁고 비대칭. 뼈가 튀어나온다
   ═══════════════════════════════════════════ */
const CHICKEN_MEAT: V[] = [
  [-9, -15], [7, -22], [23, -14], [28, 1], [18, 18], [-1, 19], [-11, 6],
];
const CHICKEN_BONE: V[] = [
  [-35, 1], [-14, -7], [-11, 6], [-33, 13],
];

/* ═══════════════════════════════════════════
   10. 고구마 — 휜 타원. 어느 쪽으로도 안 눕는다
   ═══════════════════════════════════════════ */
const GOGUMA_A: V[] = [
  [-34, 3], [-25, -8], [-3, -12], [5, -2], [-2, 9], [-24, 11],
];
const GOGUMA_B: V[] = [
  [-3, -12], [19, -11], [33, -1], [24, 10], [-2, 9],
];

/* ═══════════════════════════════════════════════════════════
   음식 목록
   ═══════════════════════════════════════════════════════════ */
export const FOODS: FoodDef[] = [
  /* ── 호떡 ── */
  {
    key: 'hotteok',
    name: '호떡',
    desc: '넓고 평평 — 최고의 받침',
    tier: 1,
    parts: [{ verts: HOTTEOK_V }],
    friction: 0.72,
    frictionStatic: 0.9,
    restitution: 0.02,
    density: 0.0016,
    bbox: { w: 68, h: 32 },
    draw(c) {
      const body = () => poly(c, HOTTEOK_V);
      c.fillStyle = lin(c, 0, -17, 0, 15, [
        [0, '#e8a94e'], [0.45, '#c67e26'], [1, '#8a4f13'],
      ]);
      body();
      c.fill();
      rim(c, body, 'rgba(255,222,160,.45)', 1.5);
      // 구운 자국
      c.fillStyle = 'rgba(110,58,10,.45)';
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.ellipse(i * 17, -4 + (i & 1 ? 4 : 0), 7, 3.4, 0.2, 0, Math.PI * 2);
        c.fill();
      }
      // 흘러나온 시럽
      c.fillStyle = 'rgba(150,80,15,.6)';
      c.beginPath();
      c.moveTo(-9, 13);
      c.quadraticCurveTo(-4, 19, 2, 13);
      c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,240,200,.35)';
      c.beginPath();
      c.ellipse(-8, -12, 13, 3.2, -0.06, 0, Math.PI * 2);
      c.fill();
    },
  },

  /* ── 만두 ── */
  {
    key: 'mandu',
    name: '만두',
    desc: '밑면이 평평해 잘 쌓인다',
    tier: 1,
    parts: [{ verts: MANDU_V }],
    friction: 0.62,
    frictionStatic: 0.78,
    restitution: 0.03,
    density: 0.0013,
    bbox: { w: 56, h: 26 },
    draw(c, t) {
      const body = () => poly(c, MANDU_V);
      c.fillStyle = lin(c, 0, -15, 0, 11, [
        [0, '#fff9ea'], [0.5, '#efe0c0'], [1, '#c0a87e'],
      ]);
      body();
      c.fill();
      rim(c, body, 'rgba(255,250,235,.42)', 1.5);
      // 주름 능선
      for (let i = -2; i <= 2; i++) {
        const x = i * 10.2;
        const bob = Math.sin(t * 3 + i) * 0.4;
        c.fillStyle = lin(c, 0, -20, 0, -8, [[0, '#fffdf5'], [1, '#dccaa6']]);
        c.beginPath();
        c.arc(x, -13 + bob, 5.6, Math.PI * 1.03, Math.PI * 1.97);
        c.closePath();
        c.fill();
        c.strokeStyle = 'rgba(150,124,86,.5)';
        c.lineWidth = 1.1;
        c.beginPath();
        c.moveTo(x - 5.3, -13 + bob);
        c.lineTo(x + 5.3, -13 + bob);
        c.stroke();
      }
      c.fillStyle = 'rgba(120,95,58,.2)';
      c.beginPath();
      c.ellipse(0, 8, 17, 2.6, 0, 0, Math.PI * 2);
      c.fill();
    },
  },

  /* ── 김밥 ── */
  {
    key: 'gimbap',
    name: '김밥',
    desc: '동그래서 잘 굴러간다 — 최악',
    tier: 3,
    parts: [{ circle: { x: 0, y: 0, r: 25 } }],
    friction: 0.22,
    frictionStatic: 0.28,
    restitution: 0.09,
    density: 0.0014,
    bbox: { w: 50, h: 50 },
    draw(c, t) {
      c.fillStyle = lin(c, 0, -25, 0, 25, [
        [0, '#2c5738'], [0.45, '#132b1b'], [1, '#0a1c11'],
      ]);
      c.beginPath();
      c.arc(0, 0, 25, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(150,230,170,.45)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(0, 0, 24, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = lin(c, -17, -17, 17, 17, [
        [0, '#ffffff'], [0.6, '#f4f1e6'], [1, '#d4cfba'],
      ]);
      c.beginPath();
      c.arc(0, 0, 18, 0, Math.PI * 2);
      c.fill();
      // 속재료 3개 — 작은 크기에서 읽히도록 크게
      const fill: [string, number][] = [['#ffd23f', 0], ['#e8622a', 2.094], ['#43b64f', 4.188]];
      for (const [col, a] of fill) {
        c.save();
        c.translate(Math.cos(a) * 8.4, Math.sin(a) * 8.4);
        c.rotate(a);
        c.fillStyle = col;
        c.beginPath();
        c.roundRect(-6.6, -4.8, 13.2, 9.6, 3.4);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,.28)';
        c.beginPath();
        c.roundRect(-6.6, -4.8, 13.2, 3.4, 2.2);
        c.fill();
        c.restore();
      }
      c.strokeStyle = 'rgba(255,255,255,.26)';
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(0, 0, 21, -1.0, 0.4);
      c.stroke();
    },
  },

  /* ── 가래떡 ── */
  {
    key: 'garaetteok',
    name: '가래떡',
    desc: '긴 막대 — 기둥이나 다리로',
    tier: 2,
    parts: [{ verts: TTEOK_V }],
    friction: 0.45,
    frictionStatic: 0.55,
    restitution: 0.04,
    density: 0.0015,
    bbox: { w: 84, h: 26 },
    draw(c) {
      const body = () => poly(c, TTEOK_V);
      c.fillStyle = lin(c, 0, -13, 0, 13, [
        [0, '#fffdf7'], [0.42, '#f2ecdd'], [1, '#c9bfa6'],
      ]);
      body();
      c.fill();
      rim(c, body, 'rgba(255,255,250,.5)', 1.5);
      c.strokeStyle = 'rgba(255,255,255,.6)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-33, -6);
      c.lineTo(33, -6);
      c.stroke();
      c.strokeStyle = 'rgba(180,168,140,.45)';
      c.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.moveTo(i * 20, -10);
        c.lineTo(i * 20, 10);
        c.stroke();
      }
    },
  },

  /* ── 붕어빵 ── */
  {
    key: 'bungeoppang',
    name: '붕어빵',
    desc: '비대칭 — 꼬리가 걸린다',
    tier: 2,
    parts: [{ verts: BUNGEO_BODY }, { verts: BUNGEO_TAIL }],
    friction: 0.58,
    frictionStatic: 0.7,
    restitution: 0.04,
    density: 0.0013,
    bbox: { w: 58, h: 37 },
    draw(c) {
      const tail = () => poly(c, BUNGEO_TAIL);
      c.fillStyle = lin(c, -38, 0, -16, 0, [[0, '#a8631d'], [1, '#d08a2c']]);
      tail();
      c.fill();
      const body = () => poly(c, BUNGEO_BODY);
      c.fillStyle = lin(c, 0, -19, 0, 18, [
        [0, '#ffd487'], [0.45, '#e09a3a'], [1, '#9e5a18'],
      ]);
      body();
      c.fill();
      rim(c, body, 'rgba(255,228,170,.48)', 1.4);
      // 빵 결
      c.strokeStyle = 'rgba(150,88,28,.5)';
      c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.arc(3, 0, 7 + i * 5, -0.95, 0.95);
        c.stroke();
      }
      c.fillStyle = 'rgba(255,240,200,.3)';
      c.beginPath();
      c.ellipse(0, -9, 9, 3.4, -0.2, 0, Math.PI * 2);
      c.fill();
      // 눈 자리 — 붕어빵 틀에 원래 찍혀 있는 자국
      c.fillStyle = 'rgba(120,70,20,.55)';
      c.beginPath();
      c.arc(15, -8, 2.1, 0, Math.PI * 2);
      c.fill();
    },
  },

  /* ── 김치 ── */
  {
    key: 'kimchi',
    name: '김치',
    desc: '밑동이 넓다 — 가장 안정적',
    tier: 1,
    parts: [{ verts: KIMCHI_STEM }, { verts: KIMCHI_LEAF }],
    friction: 0.85,
    frictionStatic: 0.98,
    restitution: 0.01,
    density: 0.0014,
    bbox: { w: 52, h: 56 },
    draw(c, t) {
      // 붉은 잎
      const leaf = () => poly(c, KIMCHI_LEAF);
      c.fillStyle = lin(c, 0, -28, 0, 6, [
        [0, '#ff6a2a'], [0.5, '#d4351f'], [1, '#8f2410'],
      ]);
      leaf();
      c.fill();
      rim(c, leaf, 'rgba(255,180,140,.35)', 1.3);
      // 잎맥
      c.strokeStyle = 'rgba(255,248,220,.3)';
      c.lineWidth = 2;
      c.lineCap = 'round';
      for (let m = -1; m <= 1; m++) {
        c.beginPath();
        c.moveTo(m * 7, 4);
        c.quadraticCurveTo(m * 9, -12, m * 7, -25);
        c.stroke();
      }
      // 흰 밑동 — 가장 밝은 덩어리
      const stem = () => poly(c, KIMCHI_STEM);
      c.fillStyle = lin(c, 0, 4, 0, 27, [
        [0, '#fffdf0'], [0.55, '#f0e8ce'], [1, '#c5b992'],
      ]);
      stem();
      c.fill();
      rim(c, stem, 'rgba(255,255,245,.5)', 1.4);
      c.strokeStyle = 'rgba(190,175,135,.55)';
      c.lineWidth = 1.4;
      for (let n = -1; n <= 1; n++) {
        c.beginPath();
        c.moveTo(n * 10, 7);
        c.lineTo(n * 9, 24);
        c.stroke();
      }
      // 양념
      c.fillStyle = 'rgba(255,170,60,.5)';
      for (let k = 0; k < 6; k++) {
        const a = t * 0.2 + k * 1.05;
        c.beginPath();
        c.arc(Math.cos(a) * 12, Math.sin(a) * 9 - 12, 1.5, 0, Math.PI * 2);
        c.fill();
      }
      c.fillStyle = '#3f9440';
      c.beginPath();
      c.ellipse(-16, -6, 6, 2.6, -0.5, 0, Math.PI * 2);
      c.fill();
    },
  },

  /* ── 계란후라이 ── */
  {
    key: 'egg',
    name: '계란후라이',
    desc: '아주 넓지만 노른자가 걸린다',
    tier: 2,
    parts: [{ verts: EGG_WHITE }, { circle: { x: 5, y: -10, r: 10 } }],
    friction: 0.8,
    frictionStatic: 0.95,
    restitution: 0.02,
    density: 0.001,
    bbox: { w: 80, h: 33 },
    draw(c) {
      const white = () => poly(c, EGG_WHITE);
      c.fillStyle = lin(c, 0, -5, 0, 13, [
        [0, '#ffffff'], [0.55, '#f6f2e6'], [1, '#d8d2bd'],
      ]);
      white();
      c.fill();
      rim(c, white, 'rgba(255,255,255,.55)', 1.5);
      // 지글지글 익은 가장자리
      c.strokeStyle = 'rgba(200,150,80,.5)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(-37, 12);
      c.lineTo(37, 12);
      c.stroke();
      // 노른자
      c.fillStyle = rad(c, 2, -13, 1, 12, [
        [0, '#fff6bd'], [0.5, '#ffc42b'], [1, '#e8830e'],
      ]);
      c.beginPath();
      c.arc(5, -10, 10, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)';
      c.beginPath();
      c.ellipse(2, -13, 3, 2.1, -0.4, 0, Math.PI * 2);
      c.fill();
    },
  },

  /* ── 닭다리 ── */
  {
    key: 'chicken',
    name: '닭다리',
    desc: '무겁다 — 아래를 짓누른다',
    tier: 3,
    parts: [{ verts: CHICKEN_MEAT }, { verts: CHICKEN_BONE }],
    friction: 0.68,
    frictionStatic: 0.8,
    restitution: 0.03,
    density: 0.0028,
    bbox: { w: 64, h: 41 },
    draw(c) {
      // 뼈
      const bone = () => poly(c, CHICKEN_BONE);
      c.fillStyle = lin(c, -35, 0, -11, 0, [[0, '#f6f1e2'], [1, '#cfc7ae']]);
      bone();
      c.fill();
      rim(c, bone, 'rgba(255,255,250,.45)', 1.3);
      c.fillStyle = '#e8e0c8';
      c.beginPath();
      c.arc(-33, 7, 4.6, 0, Math.PI * 2);
      c.fill();
      // 튀김옷 고기
      const meat = () => poly(c, CHICKEN_MEAT);
      c.fillStyle = lin(c, -9, -20, 26, 18, [
        [0, '#ffca66'], [0.42, '#df8f28'], [1, '#9c5410'],
      ]);
      meat();
      c.fill();
      rim(c, meat, 'rgba(255,225,160,.5)', 1.4);
      // 튀김옷 알갱이
      c.fillStyle = 'rgba(255,240,190,.5)';
      const bumps: V[] = [[2, -12], [14, -14], [20, -2], [10, 6], [-2, 2], [16, 10]];
      for (const [x, y] of bumps) {
        c.beginPath();
        c.ellipse(x, y, 3, 2, 0.4, 0, Math.PI * 2);
        c.fill();
      }
    },
  },

  /* ── 소떡소떡 ── */
  {
    key: 'sotteok',
    name: '소떡소떡',
    desc: '가장 길다 — 걸치기의 명수',
    tier: 2,
    parts: [
      { verts: [[-46, -3], [46, -3], [46, 3], [-46, 3]] },
      { circle: { x: -24, y: 0, r: 13 } },
      { circle: { x: 0, y: 0, r: 13 } },
      { circle: { x: 24, y: 0, r: 13 } },
    ],
    friction: 0.42,
    frictionStatic: 0.52,
    restitution: 0.05,
    density: 0.0015,
    bbox: { w: 92, h: 26 },
    draw(c) {
      // 꼬치
      c.fillStyle = lin(c, 0, -3, 0, 3, [[0, '#d8c49a'], [1, '#8f7748']]);
      c.beginPath();
      c.roundRect(-46, -2.6, 92, 5.2, 2.6);
      c.fill();
      // 소시지 - 떡 - 소시지
      const items: [number, boolean][] = [[-24, true], [0, false], [24, true]];
      for (const [x, isSausage] of items) {
        c.fillStyle = isSausage
          ? lin(c, x - 13, -13, x + 13, 13, [[0, '#e8503a'], [0.45, '#c8321f'], [1, '#8c1d10']])
          : lin(c, x - 13, -13, x + 13, 13, [[0, '#fffdf4'], [0.5, '#f0e9d6'], [1, '#c8bfa4']]);
        c.beginPath();
        c.arc(x, 0, 13, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = isSausage ? 'rgba(255,190,170,.4)' : 'rgba(255,255,250,.5)';
        c.lineWidth = 1.3;
        c.beginPath();
        c.arc(x, 0, 12.2, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = 'rgba(255,255,255,.3)';
        c.beginPath();
        c.ellipse(x - 4, -5, 4, 2.6, -0.5, 0, Math.PI * 2);
        c.fill();
      }
      // 양념 소스
      c.strokeStyle = 'rgba(230,90,30,.75)';
      c.lineWidth = 2.4;
      c.lineCap = 'round';
      c.beginPath();
      for (let x = -38; x <= 38; x += 4) {
        const y = Math.sin(x * 0.22) * 4 - 6;
        if (x === -38) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    },
  },

  /* ── 고구마 ── */
  {
    key: 'goguma',
    name: '군고구마',
    desc: '휘어 있어 어느 쪽으로도 안 눕는다',
    tier: 3,
    parts: [{ verts: GOGUMA_A }, { verts: GOGUMA_B }],
    friction: 0.55,
    frictionStatic: 0.66,
    restitution: 0.03,
    density: 0.0017,
    bbox: { w: 68, h: 23 },
    draw(c) {
      const all = () => {
        c.beginPath();
        c.moveTo(-34, 3);
        c.quadraticCurveTo(-30, -10, -3, -12);
        c.quadraticCurveTo(20, -13, 33, -1);
        c.quadraticCurveTo(28, 10, 8, 9);
        c.quadraticCurveTo(-16, 12, -34, 3);
        c.closePath();
      };
      c.fillStyle = lin(c, 0, -12, 0, 11, [
        [0, '#a35a8f'], [0.4, '#7a3a68'], [1, '#4a1f3f'],
      ]);
      all();
      c.fill();
      rim(c, all, 'rgba(240,190,220,.35)', 1.4);
      // 갈라진 틈으로 보이는 노란 속살
      c.fillStyle = lin(c, 0, -6, 0, 6, [[0, '#ffd75e'], [1, '#e59a1e']]);
      c.beginPath();
      c.moveTo(-14, -6);
      c.quadraticCurveTo(4, -9, 20, -4);
      c.quadraticCurveTo(4, 0, -14, -2);
      c.closePath();
      c.fill();
      // 구운 자국
      c.fillStyle = 'rgba(30,10,25,.5)';
      for (const [x, y] of [[-24, 4], [10, 5], [26, 2]] as V[]) {
        c.beginPath();
        c.ellipse(x, y, 4.4, 2, 0.3, 0, Math.PI * 2);
        c.fill();
      }
    },
  },
];

export const FOOD_BY_KEY: Record<string, FoodDef> = Object.fromEntries(
  FOODS.map(f => [f.key, f]),
);

/**
 * 다음에 나올 음식을 뽑는다.
 * 부스에서 처음 잡는 손님이 바로 무너지지 않도록, 초반에는 쉬운 음식(tier 1)의
 * 비중을 높이고 turn이 늘수록 어려운 음식이 섞이게 한다.
 */
export function pickFood(turn: number, rnd: () => number = Math.random): FoodDef {
  const maxTier = turn < 3 ? 1 : turn < 6 ? 2 : 3;
  const pool = FOODS.filter(f => f.tier <= maxTier);
  return pool[Math.floor(rnd() * pool.length)];
}
