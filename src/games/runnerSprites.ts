/**
 * 네온 러너 스프라이트 — Canvas 2D 패스로 직접 그린 오리지널 아트
 * 주자는 발이 (0,0)에 오는 로컬 좌표계, 장애물은 월드 좌표로 그린다.
 */

import { drawSprite, type SpriteKey } from '../lib/sprites';

type Ctx = CanvasRenderingContext2D;

/**
 * 장애물 자리에 음식 스프라이트를 채워 그린다.
 * 히트박스(x,y,w,h)를 그대로 채우므로 보이는 것과 부딪히는 것이 같다.
 * 이미지가 아직 없으면 false — 호출 측이 기존 벡터 그림으로 넘어간다.
 */
function fillBox(ctx: Ctx, key: SpriteKey, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  const ok = drawSprite(ctx, key, w, h);
  ctx.restore();
  return ok;
}
type Stops = [number, string][];

/**
 * 그라디언트 캐시 — 장애물은 매 프레임 x가 바뀌므로, 로컬 좌표계로 translate한 뒤
 * 고정 좌표 그라디언트를 재사용한다 (프레임당 할당 제거).
 */
const gcache = new WeakMap<Ctx, Map<string, CanvasGradient>>();

function cached(ctx: Ctx, key: string, make: () => CanvasGradient, stops: Stops) {
  let m = gcache.get(ctx);
  if (!m) { m = new Map(); gcache.set(ctx, m); }
  let g = m.get(key);
  if (!g) {
    g = make();
    for (const [o, c] of stops) g.addColorStop(o, c);
    m.set(key, g);
  }
  return g;
}

const lin = (ctx: Ctx, key: string, x0: number, y0: number, x1: number, y1: number, stops: Stops) =>
  cached(ctx, key, () => ctx.createLinearGradient(x0, y0, x1, y1), stops);

const rad = (ctx: Ctx, key: string, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, stops: Stops) =>
  cached(ctx, key, () => ctx.createRadialGradient(x0, y0, r0, x1, y1, r1), stops);

interface RunnerState {
  duck: boolean;
  onGround: boolean;
  running: boolean;
  legT: number;
  vy: number;
}

const SKIN = '#ffd7b0';
const SUIT = '#00ffc8';
const SUIT_DARK = '#059e7d';

/**
 * 슬라이딩 자세 — 몸을 완전히 지면과 나란히 눕힌 별도 포즈.
 * (서 있는 스프라이트를 회전시키면 "기울어진 사람"으로 보여 따로 그린다)
 */
function drawSlide(ctx: Ctx, t: number) {
  const bob = Math.sin(t * 22) * 0.8;   // 지면에 쓸리는 미세 진동

  ctx.save();
  ctx.translate(0, bob);

  // 지면 마찰 스파크
  ctx.fillStyle = 'rgba(255,215,0,.75)';
  for (let i = 0; i < 4; i++) {
    const sx = -18 - ((t * 420 + i * 27) % 46);
    const sy = -2 - ((i * 7) % 9);
    ctx.fillRect(sx, sy, 3.5, 1.6);
  }

  // 뒷다리 (뒤로 뻗음)
  ctx.strokeStyle = SUIT_DARK;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-4, -12);
  ctx.lineTo(-19, -8);
  ctx.stroke();

  // 앞다리 (접어 올림)
  ctx.strokeStyle = SUIT;
  ctx.beginPath();
  ctx.moveTo(-4, -12);
  ctx.lineTo(-13, -17);
  ctx.lineTo(-3, -19);
  ctx.stroke();

  // 몸통 — 수평으로 누운 캡슐
  ctx.fillStyle = lin(ctx, 'r:slide', -18, -20, 12, -6, [
    [0, SUIT], [1, '#9dfff0'],
  ]);
  ctx.beginPath();
  ctx.roundRect(-18, -20, 30, 12, 6);
  ctx.fill();

  // 가슴 발광 라인
  ctx.strokeStyle = '#eafffb';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-9, -18);
  ctx.lineTo(-4, -13);
  ctx.moveTo(-3, -18);
  ctx.lineTo(2, -13);
  ctx.stroke();

  // 앞으로 뻗은 팔
  ctx.strokeStyle = SUIT;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(8, -16);
  ctx.lineTo(20, -12);
  ctx.stroke();
  ctx.strokeStyle = SUIT_DARK;
  ctx.beginPath();
  ctx.moveTo(8, -13);
  ctx.lineTo(17, -19);
  ctx.stroke();

  // 머리 — 몸통 앞쪽에 낮게
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(15, -21, 6.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = SUIT;                 // 헬멧 (위쪽을 덮음)
  ctx.beginPath();
  ctx.arc(15, -22, 7.4, Math.PI * 1.02, Math.PI * 2.05);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0b2b3d';             // 바이저 (진행 방향)
  ctx.beginPath();
  ctx.ellipse(18.5, -20, 4, 2.7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,245,255,.7)';
  ctx.beginPath();
  ctx.ellipse(19.6, -21, 1.4, 1, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // 헬멧 크레스트 (뒤로 눕혀짐)
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(10, -27);
  ctx.lineTo(3, -25);
  ctx.lineTo(9.5, -23.5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/** 주자 — 바이저를 쓴 네온 러너 */
export function drawRunner(ctx: Ctx, s: RunnerState) {
  if (s.duck) { drawSlide(ctx, s.legT * 0.06); return; }

  const swing = Math.sin(s.legT);
  const swing2 = Math.sin(s.legT + Math.PI);
  const air = !s.onGround;

  ctx.save();

  const skin = SKIN;
  const suit = SUIT;
  const suitDark = SUIT_DARK;

  // ── 뒷팔
  ctx.strokeStyle = suitDark;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-2, -38);
  if (air) { ctx.lineTo(-13, -46); }
  else { ctx.lineTo(-4 + swing2 * 11, -30 + Math.abs(swing2) * 3); }
  ctx.stroke();

  // ── 다리
  ctx.strokeStyle = suit;
  ctx.lineWidth = 6;
  ctx.beginPath();
  if (air) {
    // 공중: 앞다리 접고 뒷다리 뻗음 (상승/하강에 따라 각도 변화)
    const t = s.vy < 0 ? 1 : -1;
    ctx.moveTo(0, -22);
    ctx.lineTo(9, -14 - t * 3);
    ctx.lineTo(13, -3);
    ctx.moveTo(0, -22);
    ctx.lineTo(-9, -12 + t * 2);
    ctx.lineTo(-14, -6 + t * 2);
  } else {
    ctx.moveTo(0, -22);
    ctx.lineTo(swing * 9, -12);
    ctx.lineTo(swing * 13, -1);
    ctx.moveTo(0, -22);
    ctx.lineTo(swing2 * 9, -12);
    ctx.lineTo(swing2 * 13, -1);
  }
  ctx.stroke();

  // ── 몸통
  ctx.fillStyle = lin(ctx, 'r:torso', -8, -44, 8, -20, [
    [0, '#9dfff0'], [1, suit],
  ]);
  ctx.beginPath();
  ctx.moveTo(-7, -42);
  ctx.quadraticCurveTo(0, -44, 7, -42);
  ctx.lineTo(6, -21);
  ctx.quadraticCurveTo(0, -19, -6, -21);
  ctx.closePath();
  ctx.fill();

  // 가슴 발광 라인
  ctx.strokeStyle = '#eafffb';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, -37);
  ctx.lineTo(3, -33);
  ctx.moveTo(-3, -31);
  ctx.lineTo(3, -27);
  ctx.stroke();

  // ── 머리 + 헬멧
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(1, -50, 7.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = suit;               // 헬멧
  ctx.beginPath();
  ctx.arc(1, -51, 8, Math.PI * 1.05, Math.PI * 2.1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0b2b3d';           // 바이저
  ctx.beginPath();
  ctx.ellipse(4.5, -49, 4.2, 2.9, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(170,245,255,.7)';
  ctx.beginPath();
  ctx.ellipse(5.6, -50, 1.5, 1, -0.25, 0, Math.PI * 2);
  ctx.fill();

  // 헬멧 크레스트
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(-3, -56);
  ctx.lineTo(-9, -52);
  ctx.lineTo(-3.5, -51.5);
  ctx.closePath();
  ctx.fill();

  // ── 앞팔
  ctx.strokeStyle = suit;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(2, -38);
  if (air) { ctx.lineTo(13, -47); }
  else { ctx.lineTo(4 + swing * 11, -30 + Math.abs(swing) * 3); }
  ctx.stroke();

  ctx.restore();
}

/** 속도감을 주는 잔상 — 주자 뒤로 흐르는 라인 */
export function drawSpeedLines(ctx: Ctx, x: number, y: number, speed: number, t: number) {
  const n = Math.min(6, Math.floor(speed / 130));
  ctx.strokeStyle = 'rgba(0,255,200,.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const off = ((t * speed * 0.9 + i * 37) % 90);
    const ly = y - 12 - ((i * 13) % 40);
    ctx.moveTo(x - 22 - off, ly);
    ctx.lineTo(x - 42 - off, ly);
  }
  ctx.stroke();
}

/** 지상 장애물 — 경고 스트라이프가 들어간 화물 컨테이너 */
export function drawCrate(ctx: Ctx, x: number, y: number, w: number, h: number, tall: boolean) {
  // 2단 점프용 높은 장애물(30x140)은 라면 봉지를 5단으로 쌓는다.
  // 봉지 비율(1.13)이 칸 비율(30/28=1.07)과 거의 같아 왜곡이 5%뿐이다.
  // 컵을 3단으로 쌓으면 칸이 0.64가 되어 28%나 눌린 채 보였다.
  if (tall) {
    const n = 5, ph = h / n;
    let drawn = true;
    for (let i = 0; i < n; i++) drawn = fillBox(ctx, 'buldak', x, y - h + i * ph, w, ph) && drawn;
    if (drawn) return;
  } else if (fillBox(ctx, 'cupramyeon', x, y - h, w, h)) {
    return;
  }

  const base = tall ? '#ff8f4a' : '#ffb03a';
  const dark = tall ? '#8a3c0f' : '#8a5a06';
  const wk = Math.round(w); // 캐시 키 (폭은 랜덤 실수라 반올림해 종류를 제한)

  ctx.save();
  ctx.translate(x, y - h); // 이후 로컬 좌표: (0,0)이 상자 좌상단

  ctx.fillStyle = lin(ctx, `cr:${wk}:${tall}`, 0, 0, wk, 0, [
    [0, dark], [0.35, base], [1, dark],
  ]);
  ctx.fillRect(0, 0, w, h);

  // 경고 사선
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.strokeStyle = 'rgba(20,14,4,.45)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  for (let i = -h; i < w + h; i += 15) {
    ctx.moveTo(i, h);
    ctx.lineTo(i + h, 0);
  }
  ctx.stroke();
  ctx.restore();

  // 프레임 + 상단 하이라이트
  ctx.strokeStyle = '#ffe0a8';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(3, 3, w - 6, 3);

  // 리벳
  ctx.fillStyle = 'rgba(20,14,4,.5)';
  for (const rx of [5, w - 7]) {
    ctx.fillRect(rx, 8, 2.5, 2.5);
    ctx.fillRect(rx, h - 11, 2.5, 2.5);
  }
  ctx.restore();
}

/** 공중 장애물 — 회전 로터와 스캔 아이가 달린 호버 드론 */
export function drawDrone(ctx: Ctx, x: number, y: number, w: number, h: number, t: number) {
  // 날아오는 장애물 — 만두는 비율(1.81)이 히트박스(1.77)와 거의 같아 왜곡이 없다
  if (fillBox(ctx, 'mandu', x, y, w, h)) {
    // 떠 있는 느낌을 위한 잔상
    ctx.fillStyle = `rgba(255,200,120,${0.16 + Math.abs(Math.sin(t * 6)) * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 5, w * 0.42, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.save();
  ctx.translate(cx, cy);

  // 로터 (회전 블러를 폭 변화로 표현)
  const blur = Math.abs(Math.cos(t * 9)) * 0.7 + 0.3;
  ctx.fillStyle = 'rgba(255,95,158,.5)';
  ctx.beginPath();
  ctx.ellipse(-w / 2 + 4, -h / 2 - 2, 11 * blur, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(w / 2 - 4, -h / 2 - 2, 11 * blur, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 로터 지지대
  ctx.strokeStyle = '#8c2a52';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + 4, -h / 2 - 2);
  ctx.lineTo(-w / 4, 0);
  ctx.moveTo(w / 2 - 4, -h / 2 - 2);
  ctx.lineTo(w / 4, 0);
  ctx.stroke();

  // 동체
  ctx.fillStyle = lin(ctx, `dr:${h}`, 0, -h / 2, 0, h / 2, [
    [0, '#ff9dc4'], [1, '#c22a5f'],
  ]);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  ctx.fill();

  // 스캔 아이 (좌우로 움직임)
  ctx.fillStyle = '#2a0716';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 5, -3.5, w - 10, 8, 4);
  ctx.fill();
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(Math.sin(t * 3) * (w / 2 - 10), 0.5, 3, 0, Math.PI * 2);
  ctx.fill();

  // 하부 추진 글로우
  ctx.fillStyle = rad(ctx, `dr:u:${h}`, 0, h / 2, 1, 0, h / 2, 14, [
    [0, 'rgba(255,95,158,.45)'], [1, 'rgba(255,95,158,0)'],
  ]);
  ctx.beginPath();
  ctx.ellipse(0, h / 2 + 2, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** 낮은 천장 — 케이블에 매달린 배관 구조물 */
export function drawCeiling(ctx: Ctx, x: number, y: number, w: number, h: number) {
  const top = y - h;

  if (fillBox(ctx, 'gimbap', x, top, w, h)) {
    // 매달린 줄
    ctx.strokeStyle = '#5a4d8a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let cx = x + 16; cx < x + w; cx += 48) {
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, top + 4);
    }
    ctx.stroke();
    return;
  }

  // 케이블
  ctx.strokeStyle = '#5a4d8a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let cx = x + 16; cx < x + w; cx += 48) {
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, top);
  }
  ctx.stroke();

  // 본체 (세로 그라디언트라 y만 고정이면 캐시 가능)
  ctx.fillStyle = lin(ctx, `ce:${h}`, 0, top, 0, top + h, [
    [0, '#d6c9ff'], [0.5, '#b09aff'], [1, '#6a52b8'],
  ]);
  ctx.beginPath();
  ctx.roundRect(x, top, w, h, 5);
  ctx.fill();

  // 배관 링
  ctx.strokeStyle = 'rgba(35,22,72,.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let px = x + 12; px < x + w - 6; px += 22) {
    ctx.moveTo(px, top + 3);
    ctx.lineTo(px, top + h - 3);
  }
  ctx.stroke();

  // 하단 경고등
  ctx.fillStyle = '#ffd700';
  for (let px = x + 10; px < x + w - 6; px += 44) ctx.fillRect(px, top + h - 4, 8, 3);
}
