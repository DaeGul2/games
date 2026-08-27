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
 *   여기서 G는 감으로 정한 게 아니라 **게이트 뽑기를 10,000판 돌려 잰 중앙값 성장률**이다
 *   (scripts 없이 scratchpad에서 arrowBalance를 그대로 불러 측정).
 *   기준선은 고정이므로, 잘 고른 사람은 기준선을 앞질러 적을 녹이고
 *   못 고른 사람은 뒤처져 죽는다. 고르는 행위에 의미가 생긴다.
 */

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
  mul: number;
  rate: number;
  pierce: number;
  hp: number;
  maxHp: number;
  shield: number;
}

export function initialStats(): Stats {
  return {
    n: BASE.n, dmg: BASE.dmg, mul: BASE.mul, rate: BASE.rate,
    pierce: BASE.pierce, hp: BASE.hp, maxHp: BASE.hp, shield: 0,
  };
}

/** 관통은 뒤의 적까지 맞히므로 실효 화력이 오른다 (한 발이 평균 이만큼 더 일한다) */
export const pierceBonus = (p: number) => 1 + 0.18 * (p - 1);

/** 초당 총 피해량 */
export function dps(s: Stats) {
  return s.n * s.dmg * s.mul * s.rate * pierceBonus(s.pierce);
}

/** 한 발당 피해 — 화면에 그리는 개수를 제한해도 총 화력이 변하지 않게 보정한다 */
export function damagePerArrow(s: Stats) {
  const shown = Math.min(s.n, VISUAL_N_CAP);
  return s.dmg * s.mul * (s.n / shown);
}

export function shownArrows(s: Stats) {
  return Math.min(s.n, VISUAL_N_CAP);
}

/* ===== 게이트 =====
 * 매번 두 장을 뽑아 하나만 고르게 한다. 가중치는 뽑히는 빈도.
 * 공격 계열이 80, 생존 계열이 20 — 생존만 고르면 화력이 기준선에 못 미쳐 결국 막힌다.
 */
export type GateKey = 'add' | 'mulN' | 'dmg' | 'rate' | 'pierce' | 'hp' | 'heal' | 'shield';

export interface Gate {
  key: GateKey;
  label: string;
  /** 짧은 설명 — 부스 손님이 3초 안에 읽어야 한다 */
  desc: string;
  color: string;
  weight: number;
  apply: (s: Stats) => void;
}

export const GATES: Gate[] = [
  {
    key: 'add', label: '젓가락 +2', desc: '한 번에 2개 더', color: '#ffc23a', weight: 22,
    apply: s => { s.n += 2; },
  },
  {
    key: 'mulN', label: '젓가락 ×1.6', desc: '개수가 확 늘어난다', color: '#ff6f5e', weight: 10,
    apply: s => { s.n = Math.max(s.n + 1, Math.round(s.n * 1.6)); },
  },
  {
    key: 'dmg', label: '공격력 +25%', desc: '한 발이 더 아프게', color: '#ff5f9e', weight: 20,
    apply: s => { s.mul *= 1.25; },
  },
  {
    key: 'rate', label: '연사 +15%', desc: '더 빠르게 쏜다', color: '#4aa8ff', weight: 16,
    apply: s => { s.rate = Math.min(RATE_CAP, s.rate * 1.15); },
  },
  {
    key: 'pierce', label: '관통 +1', desc: '적을 뚫고 지나간다', color: '#a97bff', weight: 12,
    apply: s => { s.pierce += 1; },
  },
  {
    key: 'hp', label: '최대 체력 +30', desc: '더 오래 버틴다', color: '#35d6a4', weight: 10,
    apply: s => { s.maxHp += 30; s.hp = Math.min(s.maxHp, s.hp + 30); },
  },
  {
    key: 'heal', label: '회복 +50%', desc: '체력을 절반 채운다', color: '#9ede3a', weight: 6,
    apply: s => { s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.5); },
  },
  {
    key: 'shield', label: '보호막 +1', desc: '한 번은 그냥 막는다', color: '#22c1c3', weight: 4,
    apply: s => { s.shield += 1; },
  },
];

const TOTAL_W = GATES.reduce((a, g) => a + g.weight, 0);

export function rollGate(rnd: () => number = Math.random): Gate {
  let r = rnd() * TOTAL_W;
  for (const g of GATES) { r -= g.weight; if (r <= 0) return g; }
  return GATES[0];
}

/** 서로 다른 두 장을 뽑아 제시한다 */
export function rollChoices(rnd: () => number = Math.random): [Gate, Gate] {
  const a = rollGate(rnd);
  let b = rollGate(rnd);
  for (let i = 0; i < 8 && b.key === a.key; i++) b = rollGate(rnd);
  return [a, b];
}

/* ===== 적 =====
 * 체력 기준선은 "게이트를 평균적으로 고른 사람"의 화력을 따라간다.
 * GROWTH는 게이트 뽑기를 대량으로 돌려 측정한 중앙값 성장률이다. (아래 주석 참고)
 */

/** 게이트 1회당 화력 성장 중앙값 — 시뮬레이션으로 측정한 값 */
export const GROWTH = 1.215;

/** w번째 구간에서 기대되는 화력 */
export function baselineDps(w: number) {
  return dps(initialStats()) * Math.pow(GROWTH, w);
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
export const WAVE = {
  /** 한 구간 길이(초) */
  time: 7.5,
  /** 몇 구간마다 보스 */
  bossEvery: 5,
  /** w구간에 나오는 적 수 */
  count: (w: number) => Math.min(22, 3 + Math.floor(w * 0.65)),
  /** w구간의 이동 속도 배수 — 내려오는 속도가 붙어야 놓친 적이 바로 아프다 */
  speedMul: (w: number) => 1 + w * 0.028,
};

/** 처치 점수 — 구간이 오를수록 커지지만 체력 증가보다는 완만하게 */
export function enemyScore(kind: EnemyKind, w: number) {
  const base = { grunt: 10, runner: 14, tank: 40, boss: 250 }[kind];
  return Math.round(base * Math.pow(1.09, w));
}
