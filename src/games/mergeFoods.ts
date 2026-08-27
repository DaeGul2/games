/**
 * K-푸드 합치기 — 진화 체인
 *
 * 수박게임의 규칙을 K-푸드로 옮긴 것. 같은 음식 둘이 닿으면 한 단계 위로 진화한다.
 *
 * ── 왜 구슬에 담는가
 * 이 장르는 **모든 조각이 원**이어야 성립한다. 굴러서 틈을 메우고, 같은 것끼리
 * 자연스럽게 만나야 하기 때문이다. 그런데 가진 스프라이트는 김밥(비율 3.2)·핫도그(3.7)처럼
 * 길쭉한 것이 많아 원 판정에 그대로 넣으면 그림과 판정이 어긋난다.
 * 그래서 음식을 **유리구슬 안에 담는다.** 구슬이 곧 충돌 원이라 둘이 정확히 일치한다.
 *
 * ── 왜 단계마다 색을 따로 주는가
 * 음식 고유색을 쓰면 붉은 것(떡볶이·김치·불닭·양념치킨)이 몰려 단계 구분이 안 된다.
 * 그래서 구슬 색은 음식과 무관하게 **인접 단계가 최대한 달라 보이도록** 따로 배열했다.
 * 크기·색·그림 세 가지가 동시에 단계를 알려준다.
 *
 * ── 왜 반지름 비를 √2보다 작게 두는가
 * 반지름이 √2배씩 커지면 면적이 정확히 2배라, 합쳐도 공간이 하나도 생기지 않는다.
 * 1.21배로 두면 면적비가 1.46이라 **합칠 때마다 약 27%의 공간이 새로 생긴다.**
 * 쌓이는 속도와 비워지는 속도의 줄다리기가 이 게임 재미의 전부다.
 */
import { type SpriteKey } from '../lib/sprites';

export interface MergeLevel {
  /** 1부터 시작하는 단계 */
  level: number;
  key: SpriteKey;
  name: string;
  /** 충돌 원의 반지름 = 구슬 반지름 */
  r: number;
  /** 구슬 색 */
  color: string;
  /** 이 단계가 **만들어질 때** 주는 점수 (삼각수) */
  score: number;
}

/**
 * 반지름 등비 — √2(=면적 2배)보다 작아야 합칠 때 공간이 생긴다.
 * 1.19면 면적비 1.416이라 **합칠 때마다 약 29%의 공간이 생긴다.**
 *
 * 이 값과 상자 크기는 감이 아니라 엔진을 돌려 정했다 (상자 폭 280~430,
 * 성장비 1.17~1.21을 교차로 돌려본 결과). 1.21로 두면 최종 지름이 상자의 76%까지
 * 커져 후반이 답답했고, 1.17이면 판이 안 끝나 300회를 넘게 떨어뜨려야 했다.
 */
const RATIO = 1.19;
const BASE_R = 15;

/**
 * 진화 순서 — 간식에서 시작해 한 상 차림으로 끝난다.
 * 색은 이웃끼리 따뜻함/차가움이 번갈아 오도록 배치했다.
 */
const CHAIN: [SpriteKey, string, string][] = [
  ['coinbread',  '10원빵',   '#ffc23a'],
  ['mandu',      '만두',     '#35d6a4'],
  ['gimbap',     '김밥',     '#ff6f5e'],
  ['sotteok',    '소떡소떡', '#4aa8ff'],
  ['hotdog',     '핫도그',   '#ffa62b'],
  ['chicken',    '양념치킨', '#a97bff'],
  ['cupramyeon', '컵라면',   '#9ede3a'],
  ['cupteok',    '컵떡볶이', '#ff5f9e'],
  ['buldak',     '불닭',     '#22c1c3'],
  ['kimchi',     '김치',     '#ff7043'],
  ['ramyeon',    '라면',     '#c9a7ff'],
  ['tteokbokki', '떡뽁이',   '#ffd700'],
];

/** 삼각수 Tₙ = n(n+1)/2 — 등차면 큰 걸 만들 이유가 없고, 지수면 후반이 폭주한다 */
const tri = (n: number) => (n * (n + 1)) / 2;

export const LEVELS: MergeLevel[] = CHAIN.map(([key, name, color], i) => ({
  level: i + 1,
  key,
  name,
  color,
  r: +(BASE_R * Math.pow(RATIO, i)).toFixed(2),
  // 레벨 n이 만들어질 때 T(n-1)점. 1단계는 떨어뜨리기만 하므로 0점.
  score: i === 0 ? 0 : tri(i),
}));

export const MAX_LEVEL = LEVELS.length;

/** 떨어뜨릴 수 있는 것은 아래 5단계까지. 큰 것은 오직 합쳐서만 만든다 */
export const DROP_MAX_LEVEL = 5;

export function pickDropLevel(rnd: () => number = Math.random) {
  return 1 + Math.floor(rnd() * DROP_MAX_LEVEL);
}

/** 한 단계 위를 만드는 데 필요한 1단계 개수 = 2^(n-1) */
export function costOf(level: number) {
  return Math.pow(2, level - 1);
}
