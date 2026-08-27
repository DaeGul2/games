/**
 * K-푸드 타워 — 음식 정의
 *
 * 그림은 픽셀아트 스프라이트(public/sprites)를 쓰고, **충돌 도형은 그 그림의 알파
 * 실루엣에서 뽑는다** (scripts/build-sprites.cjs → spriteManifest.ts). 그래서 보이는 모양과
 * 부딪히는 모양이 정확히 같다. 손으로 다각형을 찍어 맞출 필요가 없다.
 *
 * 실루엣이 곧 물리 특성이다 — 10원빵은 동그래서 굴러가고, 김밥은 길어서 다리로 쓰기 좋고,
 * 냄비·그릇류는 바닥이 평평해 잘 쌓인다. 밸런스 수치가 아니라 모양으로 성격을 만든다.
 */
import {
  drawSprite,
  colliderOf,
  SPRITES,
  type SpriteKey,
} from '../lib/sprites';

type Ctx = CanvasRenderingContext2D;

export interface Part {
  /** 볼록 다각형 꼭짓점 (로컬 좌표) */
  verts?: [number, number][];
  /** 원 — 굴림 특성이 필요한 조각 */
  circle?: { x: number; y: number; r: number };
}

export interface FoodDef {
  key: SpriteKey;
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
  bbox: { w: number; h: number };
  draw: (ctx: Ctx, t: number) => void;
}

/** 음식별 설정 — 표시 폭(px)과 물리 성질만 정하면 나머지는 스프라이트에서 파생된다 */
interface Spec {
  key: SpriteKey;
  desc: string;
  tier: 1 | 2 | 3;
  /** 게임에서 그릴 폭. 높이는 원본 비율 유지 */
  w: number;
  friction: number;
  frictionStatic: number;
  restitution: number;
  density: number;
  /** 동그란 것은 원 콜라이더로 — 다각형이면 미묘하게 덜컹거린다 */
  round?: boolean;
}

const SPECS: Spec[] = [
  /* ── 잘 쌓이는 것 (tier 1) ── */
  {
    key: 'ramyeon', desc: '냄비 바닥이 평평 — 최고의 받침', tier: 1, w: 78,
    friction: 0.78, frictionStatic: 0.92, restitution: 0.02, density: 0.0016,
  },
  {
    key: 'tteokbokki', desc: '넓은 그릇 — 안정적인 받침', tier: 1, w: 74,
    friction: 0.76, frictionStatic: 0.9, restitution: 0.02, density: 0.0016,
  },
  {
    key: 'kimchi', desc: '납작한 접시 — 아래를 받치기 좋다', tier: 1, w: 72,
    friction: 0.82, frictionStatic: 0.95, restitution: 0.01, density: 0.0015,
  },
  {
    key: 'mandu', desc: '밑면이 평평해 잘 쌓인다', tier: 1, w: 64,
    friction: 0.62, frictionStatic: 0.78, restitution: 0.03, density: 0.0013,
  },

  /* ── 보통 (tier 2) ── */
  {
    key: 'gimbap', desc: '가장 길다 — 걸쳐서 다리를 놓아라', tier: 2, w: 88,
    friction: 0.52, frictionStatic: 0.64, restitution: 0.04, density: 0.0014,
  },
  {
    key: 'buldak', desc: '봉지라 미끄럽다', tier: 2, w: 66,
    friction: 0.4, frictionStatic: 0.5, restitution: 0.05, density: 0.0011,
  },
  {
    key: 'cupramyeon', desc: '컵 — 세워 두면 훌륭한 기둥', tier: 2, w: 56,
    friction: 0.72, frictionStatic: 0.86, restitution: 0.02, density: 0.0014,
  },
  {
    key: 'cupteok', desc: '컵 — 위가 넓어 살짝 불안하다', tier: 2, w: 56,
    friction: 0.7, frictionStatic: 0.84, restitution: 0.02, density: 0.0014,
  },
  {
    key: 'chicken', desc: '무겁고 비대칭 — 아래를 짓누른다', tier: 2, w: 74,
    friction: 0.68, frictionStatic: 0.8, restitution: 0.03, density: 0.0026,
  },

  /* ── 어려운 것 (tier 3) ── */
  {
    key: 'coinbread', desc: '동그래서 잘 굴러간다 — 최악', tier: 3, w: 62,
    friction: 0.24, frictionStatic: 0.3, restitution: 0.09, density: 0.0015, round: true,
  },
  {
    key: 'sotteok', desc: '길쭉한 꼬치 — 걸치기 좋다', tier: 3, w: 78,
    friction: 0.46, frictionStatic: 0.56, restitution: 0.04, density: 0.0014,
  },
  {
    key: 'hotdog', desc: '가장 얇다 — 위에 뭘 올리기 어렵다', tier: 3, w: 84,
    friction: 0.42, frictionStatic: 0.52, restitution: 0.05, density: 0.0013,
  },
];

/** 이미지가 아직 안 왔을 때 형태만이라도 보여주는 대체 그림 */
function placeholder(c: Ctx, poly: [number, number][]) {
  if (!poly.length) return;
  c.beginPath();
  c.moveTo(poly[0][0], poly[0][1]);
  for (let i = 1; i < poly.length; i++) c.lineTo(poly[i][0], poly[i][1]);
  c.closePath();
  c.fillStyle = 'rgba(140,120,90,.55)';
  c.fill();
  c.strokeStyle = 'rgba(255,225,180,.4)';
  c.lineWidth = 1.4;
  c.stroke();
}

function build(s: Spec): FoodDef {
  const meta = SPRITES[s.key];
  const h = (s.w * meta.h) / meta.w;
  const poly = colliderOf(s.key, s.w);
  const parts: Part[] = s.round
    ? [{ circle: { x: 0, y: 0, r: Math.min(s.w, h) / 2 } }]
    : [{ verts: poly }];

  return {
    key: s.key,
    name: meta.ko,
    desc: s.desc,
    tier: s.tier,
    parts,
    friction: s.friction,
    frictionStatic: s.frictionStatic,
    restitution: s.restitution,
    density: s.density,
    bbox: { w: s.w, h },
    draw(c) {
      if (!drawSprite(c, s.key, s.w, h)) placeholder(c, poly);
    },
  };
}

export const FOODS: FoodDef[] = SPECS.map(build);

export const FOOD_BY_KEY: Record<string, FoodDef> = Object.fromEntries(
  FOODS.map(f => [f.key, f]),
);

/**
 * 다음에 나올 음식을 뽑는다.
 * 부스에서 처음 잡는 손님이 바로 무너지지 않도록, 초반에는 쉬운 음식(tier 1)만 주고
 * turn이 늘수록 어려운 음식이 섞이게 한다.
 */
export function pickFood(turn: number, rnd: () => number = Math.random): FoodDef {
  const maxTier = turn < 3 ? 1 : turn < 6 ? 2 : 3;
  const pool = FOODS.filter(f => f.tier <= maxTier);
  return pool[Math.floor(rnd() * pool.length)];
}
