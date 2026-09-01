/**
 * K-푸드 사격 — 수치 설계
 *
 * 이 장르(Arrow a Row 계열)의 성패는 전부 **한 가지 방정식**에 달려 있다.
 *
 *     플레이어 화력이 커지는 속도  vs  적 체력이 커지는 속도
 *
 * 화력이 빠르면 후반이 시시해지고, 적 체력이 빠르면 아무리 강화해도 제자리라
 * 강화하는 맛이 없다. 그래서 둘을 **같은 지수로 묶고**, 잘 고른 사람만 앞서가게 한다.
 *
 * ── 화력 모형
 *     DPS = 개수 N × 기본데미지 D0 × 공격배수 M × 연사 R × 관통보너스(P)
 *
 *   개수는 더하기(+2)와 곱하기(×1.6)가 섞여 있고, 공격배수·연사는 곱하기만 있다.
 *   더하기만 있으면 2→4는 2배지만 20→22는 1.1배라 후반에 성장이 멈춘다.
 *   곱하기만 있으면 폭주한다. 섞어야 "계속 세지는데 감당은 되는" 곡선이 나온다.
 *
 * ── 적 체력 모형
 *     H(w) = 목표교전시간 × DPS기준선(w),   DPS기준선(w) = DPS0 · G^w
 *
 *   여기서 G는 감으로 정한 게 아니라 **아이템 줍기를 대량으로 돌려 잰 중앙값 성장률**이다.
 *   기준선은 고정이므로, 부지런히 주운 사람은 기준선을 앞질러 적을 녹이고
 *   흘린 사람은 뒤처져 적이 새어 나온다. 줍는 행위에 의미가 생긴다.
 */

import { type SpriteKey } from '../lib/sprites';
import { T } from '../i18n';

/* ===== 시작 수치 ===== */
export const BASE = {
  /** 한 번에 나가는 젓가락 수 */
  n: 2,
  /** 젓가락 한 개의 기본 데미지 */
  dmg: 8,
  /** 공격 배수 */
  mul: 1,
  /** 초당 발사 횟수 */
  rate: 3.2,
  /** 한 발이 뚫는 적 수 (1이면 관통 없음) */
  pierce: 1,
  /** 최대 체력 */
  hp: 100,
};

/** 화면에 실제로 그리는 최대 젓가락 수 — 넘치는 개수는 데미지로 환산한다 */
export const VISUAL_N_CAP = 44;
/** 연사 상한 (초당) */
export const RATE_CAP = BASE.rate * 3.2;

export interface Stats {
  n: number;
  dmg: number;
  /** 영구 공격 배수 */
  mul: number;
  rate: number;
  pierce: number;
  hp: number;
  maxHp: number;
  shield: number;
  /** 일시 공격 배수 (×2·×3·×10 아이템) — burstT 동안만 유지 */
  burst: number;
  burstT: number;
}

export function initialStats(): Stats {
  return {
    n: BASE.n, dmg: BASE.dmg, mul: BASE.mul, rate: BASE.rate,
    pierce: BASE.pierce, hp: BASE.hp, maxHp: BASE.hp, shield: 0,
    burst: 1, burstT: 0,
  };
}

/** 관통은 뒤의 적까지 맞히므로 실효 화력이 오른다 (한 발이 평균 이만큼 더 일한다) */
export const pierceBonus = (p: number) => 1 + 0.18 * (p - 1);

/** 지금 이 순간의 실효 공격 배수 (영구 × 일시) */
export const effMul = (s: Stats) => s.mul * (s.burstT > 0 ? s.burst : 1);

/** 초당 총 피해량 */
export function dps(s: Stats) {
  return s.n * s.dmg * effMul(s) * s.rate * pierceBonus(s.pierce);
}

/** 영구 스탯만으로 본 화력 — 기준선 비교·성장률 측정용 (일시 버프 제외) */
export function baseDps(s: Stats) {
  return s.n * s.dmg * s.mul * s.rate * pierceBonus(s.pierce);
}

/** 한 발당 피해 — 화면에 그리는 개수를 제한해도 총 화력이 변하지 않게 보정한다 */
export function damagePerArrow(s: Stats) {
  const shown = Math.min(s.n, VISUAL_N_CAP);
  return s.dmg * effMul(s) * (s.n / shown);
}

/** 일시 버프 갱신 — 매 프레임 호출 */
export function tickBuffs(s: Stats, dt: number) {
  if (s.burstT > 0) {
    s.burstT -= dt;
    if (s.burstT <= 0) { s.burstT = 0; s.burst = 1; }
  }
}

/** 큰 배수 아이템 — 잠깐 폭발적으로 세지고 끝난다. 영구로 쌓이면 화력이 10^19까지 폭주했다 */
export const BURST_SECS = 7;
function burst(s: Stats, k: number) {
  // 이미 버프 중이면 더 큰 쪽을 남기고 시간을 새로 준다
  s.burst = Math.max(s.burst, k);
  s.burstT = BURST_SECS;
}

export function shownArrows(s: Stats) {
  return Math.min(s.n, VISUAL_N_CAP);
}

/* ===== 아이템 =====
 * 길 위에 K-푸드가 떠내려온다. 좌우로 움직여 **주워 먹으면** 그 자리에서 세진다.
 * 예전엔 두 장 중 하나를 고르는 게이트였는데, 라스트 워처럼 길에 뿌려두고
 * 몸으로 주우러 가는 편이 조작 하나(좌우)로 훨씬 잘 붙는다.
 *
 * 배수가 큰 것(×2·×3·×10)을 섞은 이유 — 이 장르의 맛은 숫자가 폭발하는 데 있다.
 * 대신 큰 배수일수록 가중치를 낮춰, 평균 성장률은 아래 GROWTH에 묶어 둔다.
 */
export type ItemKey =
  | 'n3' | 'n6' | 'nx2' | 'dx2' | 'dx3' | 'dx10'
  | 'rate' | 'pierce' | 'hp' | 'heal';

export interface Item {
  key: ItemKey;
  /** 어떤 K-푸드로 그릴지 */
  sprite: SpriteKey;
  /** 아이템 위에 크게 찍히는 글자 */
  tag: string;
  /** 무엇이 세지는지 (작은 글씨) */
  what: string;
  color: string;
  weight: number;
  apply: (s: Stats) => void;
}

export const ITEMS: Item[] = [
  /* ── 영구 성장 (완만) ── */
  { key: 'n3',  sprite: 'gimbap',     get tag() { return T.arrow.items.n3.tag; }, get what() { return T.arrow.items.n3.what; }, color: '#ffc23a', weight: 22,
    apply: s => { s.n += 2; } },
  { key: 'n6',  sprite: 'sotteok',    get tag() { return T.arrow.items.n6.tag; }, get what() { return T.arrow.items.n6.what; }, color: '#ffa62b', weight: 9,
    apply: s => { s.n += 4; } },
  { key: 'nx2', sprite: 'mandu',      get tag() { return T.arrow.items.nx2.tag; }, get what() { return T.arrow.items.nx2.what; }, color: '#35d6a4', weight: 5,
    apply: s => { s.n = Math.max(s.n + 2, Math.round(s.n * 1.5)); } },
  { key: 'dx2', sprite: 'cupramyeon', get tag() { return T.arrow.items.dx2.tag; }, get what() { return T.arrow.items.dx2.what; }, color: '#ff6f5e', weight: 16,
    apply: s => { s.mul *= 1.3; } },
  { key: 'rate', sprite: 'tteokbokki', get tag() { return T.arrow.items.rate.tag; }, get what() { return T.arrow.items.rate.what; }, color: '#4aa8ff', weight: 13,
    apply: s => { s.rate = Math.min(RATE_CAP, s.rate * 1.2); } },
  { key: 'pierce', sprite: 'hotdog',  get tag() { return T.arrow.items.pierce.tag; }, get what() { return T.arrow.items.pierce.what; }, color: '#a97bff', weight: 9,
    apply: s => { s.pierce += 1; } },
  /* ── 생존 ── */
  { key: 'hp',  sprite: 'chicken',    get tag() { return T.arrow.items.hp.tag; }, get what() { return T.arrow.items.hp.what; }, color: '#9ede3a', weight: 8,
    apply: s => { s.maxHp += 40; s.hp = Math.min(s.maxHp, s.hp + 40); } },
  { key: 'heal', sprite: 'coinbread', get tag() { return T.arrow.items.heal.tag; }, get what() { return T.arrow.items.heal.what; }, color: '#66e0a0', weight: 6,
    apply: s => { s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.5); } },
  /* ── 일시 폭발 (7초) — 숫자가 터지는 맛은 여기서 낸다 ── */
  { key: 'dx3', sprite: 'buldak',     get tag() { return T.arrow.items.dx3.tag; }, get what() { return T.arrow.items.dx3.what; }, color: '#ff3d2e', weight: 9,
    apply: s => burst(s, 3) },
  { key: 'dx10', sprite: 'kimchi',    get tag() { return T.arrow.items.dx10.tag; }, get what() { return T.arrow.items.dx10.what; }, color: '#ffd700', weight: 3,
    apply: s => burst(s, 10) },
];

const TOTAL_W = ITEMS.reduce((a, g) => a + g.weight, 0);

export function rollItem(rnd: () => number = Math.random): Item {
  let r = rnd() * TOTAL_W;
  for (const g of ITEMS) { r -= g.weight; if (r <= 0) return g; }
  return ITEMS[0];
}

/* ===== 적 =====
 * 체력 기준선은 "게이트를 평균적으로 고른 사람"의 화력을 따라간다.
 * GROWTH는 게이트 뽑기를 대량으로 돌려 측정한 중앙값 성장률이다. (아래 주석 참고)
 */

/** 아이템 1개당 화력 성장 중앙값 — 시뮬레이션으로 측정한 값 */
export const GROWTH = 1.155;

/**
 * w번째 구간에서 기대되는 화력.
 * 한 구간에 아이템이 ITEMS_PER_WAVE개 나오고 그중 평균적으로 얼마나 줍는지까지 반영한다.
 */
export const ITEMS_PER_WAVE = 3;
export const PICKUP_RATE = 0.9;    // 부스 손님 모델이 실제로 줍는 비율 (시뮬레이션 96% 측정, 여유 둠)

/**
 * 초반 유예 — 처음 GRACE 구간은 아직 아이템을 몇 개 못 주웠으므로 기준선을
 * 시작 화력에 묶어 둔다. 이게 없으면 젓가락 2개로 HP 100짜리 3줄을 맞아야 했다.
 */
export const GRACE_WAVES = 3;

export function baselineDps(w: number) {
  const eff = Math.max(0, w - GRACE_WAVES);
  return dps(initialStats()) * Math.pow(GROWTH, eff * ITEMS_PER_WAVE * PICKUP_RATE);
}

/** 적 종류별 목표 교전시간(초) — 이 시간 안에 녹아야 한다 */
export const TTK = {
  grunt: 0.9,
  runner: 0.6,
  tank: 3.2,
  boss: 11,
};

export type EnemyKind = keyof typeof TTK;

/** w번째 구간 적의 체력 */
export function enemyHp(kind: EnemyKind, w: number) {
  return Math.round(TTK[kind] * baselineDps(w));
}

/**
 * 적이 주는 피해.
 * 체력은 골라야만 오르는데(게이트 10/100), 피해가 지수로 커지면 아무도 못 버틴다.
 * 그래서 피해는 **선형**으로만 키운다 — 후반에는 화력으로 밀어내는 게 정답이 되도록.
 */
export function enemyDamage(kind: EnemyKind, w: number) {
  const base = { grunt: 8, runner: 6, tank: 14, boss: 18 }[kind];
  return Math.round(base + w * 1.15);
}

/**
 * 구간 진행 — 압박이 화력을 따라가야 판이 끝난다.
 *
 * 적 체력은 화력과 같은 지수로 커지므로 **한 마리당 교전시간은 일정**하다.
 * 그러면 압박은 '한 구간에 몇 마리가 오느냐'와 '얼마나 빨리 내려오느냐'에서만 나온다.
 * 처음엔 마릿수를 9로 묶어 뒀는데, 그 위로는 화력만 계속 커져서
 * 잘하는 사람이 6분이 지나도 안 죽었다. 그래서 상한을 크게 올리고 속도도 같이 키운다.
 */
/** 좌우 이동 속도 (차선 단위/초). 도로 폭이 -1~1이므로 4.0이면 0.5초에 끝에서 끝 */
export const MOVE_SPEED = 4.0;

export const WAVE = {
  /** 한 구간 길이(초) */
  time: 7.5,
  /** 몇 구간마다 보스 */
  bossEvery: 5,
  /** w구간에 나오는 적 수 */
  count: (w: number) => Math.min(22, 2 + Math.floor(w * 0.6)),
  /** w구간의 이동 속도 배수 — 초반은 느리게 다가오고, 구간이 오르며 빨라진다 */
  speedMul: (w: number) => 0.72 + Math.min(w, 10) * 0.028 + Math.max(0, w - 10) * 0.02,
};

/** 처치 점수 — 구간이 오를수록 커지지만 체력 증가보다는 완만하게 */
export function enemyScore(kind: EnemyKind, w: number) {
  const base = { grunt: 10, runner: 14, tank: 40, boss: 250 }[kind];
  return Math.round(base * Math.pow(1.09, w));
}
