/**
 * 스프라이트 로더 — public/sprites/*.png 를 미리 받아 캔버스에 그린다.
 *
 * 이미지가 아직 안 왔거나 로드에 실패해도 게임은 멈추면 안 된다. 그래서 모든 그리기
 * 함수는 "그렸는지" 여부를 boolean으로 돌려주고, 호출 측은 false일 때 기존 벡터 그림으로
 * 넘어간다. 부스에서 파일 하나가 안 받아져도 게임은 계속 돌아간다.
 */
import { SPRITES, SPRITE_KEYS, type SpriteKey } from '../games/spriteManifest';

const images = new Map<SpriteKey, HTMLImageElement>();
const failed = new Set<SpriteKey>();
let pending = 0;

function load(key: SpriteKey) {
  const img = new Image();
  pending++;
  img.onload = () => { images.set(key, img); pending--; };
  img.onerror = () => { failed.add(key); pending--; };
  img.src = `${import.meta.env.BASE_URL}sprites/${key}.png`;
}

// 모듈을 불러오는 순간 전부 예약해 둔다. 12장 · 합계 300KB 미만이라 첫 화면을 막지 않는다.
for (const k of SPRITE_KEYS) load(k);

/** 아직 받는 중인 장수 (0이면 준비 완료) */
export function spritesPending() {
  return pending;
}

export function spriteReady(key: SpriteKey) {
  return images.has(key);
}

/**
 * 스프라이트를 원점 중심으로 그린다.
 * @param w 그릴 폭. 높이는 원본 비율로 계산된다 (h를 주면 그 값을 쓴다)
 * @returns 실제로 그렸으면 true
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  w: number,
  h?: number,
): boolean {
  const img = images.get(key);
  if (!img) return false;
  const meta = SPRITES[key];
  const dh = h ?? (w * meta.h) / meta.w;
  ctx.drawImage(img, -w / 2, -dh / 2, w, dh);
  return true;
}

/** 원본 비율을 유지한 채 w×h 상자 **안에 꽉 차게** (contain) 그린다 */
export function drawSpriteContain(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  w: number,
  h: number,
): boolean {
  const img = images.get(key);
  if (!img) return false;
  const meta = SPRITES[key];
  const s = Math.min(w / meta.w, h / meta.h);
  ctx.drawImage(img, (-meta.w * s) / 2, (-meta.h * s) / 2, meta.w * s, meta.h * s);
  return true;
}

/**
 * 반지름 r인 원 **안에 꽉 차게** 그린다.
 *
 * 원에 내접하는 최대 사각형을 원본 비율로 구한다 —
 * w/h = a 이고 √(w²+h²)/2 = r·margin 을 풀면
 *   w = 2·r·margin·a/√(a²+1),  h = w/a
 * 길쭉한 김밥이든 동그란 10원빵이든 원 밖으로 삐져나오지 않는다.
 */
export function drawInCircle(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  r: number,
  margin = 0.92,
): boolean {
  const img = images.get(key);
  if (!img) return false;
  const meta = SPRITES[key];
  const a = meta.w / meta.h;
  const w = (2 * r * margin * a) / Math.sqrt(a * a + 1);
  const h = w / a;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return true;
}

/** 스프라이트의 원본 가로세로 비율 (w / h) */
export function aspectOf(key: SpriteKey) {
  return SPRITES[key].w / SPRITES[key].h;
}

/**
 * 표시 폭에 맞춰 스케일된 충돌 다각형.
 * 매니페스트의 볼록 껍질이 그림과 같은 좌표계라, 폭 비율만 곱하면 정확히 겹친다.
 */
export function colliderOf(key: SpriteKey, displayW: number): [number, number][] {
  const meta = SPRITES[key];
  const s = displayW / meta.w;
  return meta.poly.map(([x, y]) => [x * s, y * s] as [number, number]);
}

export { SPRITES, SPRITE_KEYS, type SpriteKey };
