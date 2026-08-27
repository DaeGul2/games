/**
 * 스프라이트 — Canvas 2D 패스로 직접 그린 오리지널 아트 (외부 이미지 없음)
 * 모든 함수는 (0,0)이 기체 중심인 로컬 좌표계에 그린다.
 * 호출 측에서 translate/rotate를 잡아준 뒤 사용.
 */

import { drawSprite, aspectOf, type SpriteKey } from '../lib/sprites';

type Ctx = CanvasRenderingContext2D;
type Stops = [number, string][];

/**
 * 적 자리에 음식 스프라이트를 그린다. 판정은 반지름 r의 원이므로,
 * 스프라이트의 **짧은 쪽**을 2r에 맞춰 히트박스를 항상 덮게 한다.
 * 이미지가 아직 없으면 false — 아래의 기존 벡터 그림으로 넘어간다.
 */
function food(ctx: Ctx, key: SpriteKey, r: number, scale = 1, rot = 0) {
  const a = aspectOf(key);
  const d = 2 * r * scale;
  const w = a >= 1 ? d * a : d;
  const h = a >= 1 ? d : d / a;
  if (rot) {
    ctx.save();
    ctx.rotate(rot);
    const ok = drawSprite(ctx, key, w, h);
    ctx.restore();
    return ok;
  }
  return drawSprite(ctx, key, w, h);
}

/** 판정원 안에 내접하게 그린다 (아우라 없음 — 최종보스처럼 연출을 따로 얹을 때) */
function foodInCircle(ctx: Ctx, key: SpriteKey, r: number) {
  const a = aspectOf(key);
  const w = (2 * r * 0.96 * a) / Math.sqrt(a * a + 1);
  return drawSprite(ctx, key, w, w / a);
}

/**
 * 적임을 알리는 아우라.
 *
 * 음식 스프라이트를 그대로 쓰면 "먹는 것"으로 보여서 적인지 아이템인지 헷갈린다.
 * 특히 돌진병(핫도그)과 강화 아이템은 크기도 색도 비슷해 구분이 안 됐다.
 * 그래서 적은 전부 **붉은 열기 + 회전하는 조준 링**을 두르고, 아이템은 두르지 않는다.
 *
 * level 1 잡몹 · 2 발사기/중간보스 · 3 돌진병(가장 위험, 궤적까지 남긴다)
 */
function enemyAura(ctx: Ctx, t: number, R: number, level: 1 | 2 | 3) {
  const col = ['', '255,72,64', '255,116,32', '255,44,44'][level];
  const spin = [0, 1.2, 1.8, 3.6][level];
  const pulse = 1 + Math.sin(t * (3 + level)) * 0.055;
  const k = Math.round(R);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // 붉은 열기
  ctx.fillStyle = rad(ctx, `aura:${level}:${k}`, 0, 0, R * 0.45, 0, 0, R * 1.4, [
    [0, `rgba(${col},${0.3 + level * 0.06})`],
    [0.55, `rgba(${col},${0.12 + level * 0.03})`],
    [1, `rgba(${col},0)`],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, R * 1.4 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // 돌진병은 뒤로 궤적을 남긴다 — 진행 방향이 -y이므로 +y 쪽으로
  if (level === 3) {
    ctx.fillStyle = lin(ctx, `trail:${k}`, 0, R * 0.4, 0, R * 2.6, [
      [0, `rgba(${col},.5)`],
      [1, `rgba(${col},0)`],
    ]);
    ctx.beginPath();
    ctx.moveTo(-R * 0.42, R * 0.4);
    ctx.quadraticCurveTo(0, R * 2.6, R * 0.42, R * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  // 회전하는 조준 링 — 네 조각으로 끊어 '락온' 느낌
  ctx.rotate(t * spin);
  ctx.strokeStyle = `rgba(${col},${0.55 + level * 0.12})`;
  ctx.lineWidth = 1.4 + level * 0.3;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const a0 = (i * Math.PI) / 2 + 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.1 * pulse, a0, a0 + Math.PI / 2 - 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * 적 = 아우라를 두른 음식.
 *
 * 스프라이트를 **판정원(반지름 r) 안에 내접**시킨다. 예전엔 짧은 쪽을 2r에 맞춰서
 * 긴 쪽이 판정원 밖으로 크게 삐져나왔다 — 만두는 108%, 핫도그는 377%나 커서
 * 그림 끝에 맞았는데 판정이 안 나거나 빈 공간이 맞았다. 이제 그림 = 판정 범위다.
 * (원에 내접하는 최대 사각형: w = 2r·a/√(a²+1), h = w/a)
 */
function enemyFood(
  ctx: Ctx, key: SpriteKey, t: number, r: number,
  level: 1 | 2 | 3, rot = 0,
) {
  const a = aspectOf(key);
  const w = (2 * r * 0.96 * a) / Math.sqrt(a * a + 1);
  const h = w / a;
  enemyAura(ctx, t, r, level);
  if (rot) {
    ctx.save();
    ctx.rotate(rot);
    const ok = drawSprite(ctx, key, w, h);
    ctx.restore();
    return ok;
  }
  return drawSprite(ctx, key, w, h);
}

/**
 * 그라디언트 캐시 — 캔버스 그라디언트는 user space로 정의되고 칠할 때 현재 변환이
 * 적용되므로, 로컬 좌표계에서 만든 객체를 매 프레임 재사용해도 안전하다.
 * (스프라이트가 수십 개씩 그려지는 후반 웨이브의 할당 비용을 없애기 위함)
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

function lin(ctx: Ctx, key: string, x0: number, y0: number, x1: number, y1: number, stops: Stops) {
  return cached(ctx, key, () => ctx.createLinearGradient(x0, y0, x1, y1), stops);
}

function rad(ctx: Ctx, key: string, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, stops: Stops) {
  return cached(ctx, key, () => ctx.createRadialGradient(x0, y0, r0, x1, y1, r1), stops);
}

/** 엔진 화염 — 길이가 흔들리는 이중 불꽃 */
function flame(ctx: Ctx, x: number, y: number, w: number, len: number, t: number, hot = '#fff6cc', cool = '#ff9a3c') {
  const f = len * (0.72 + Math.abs(Math.sin(t * 22)) * 0.42);
  ctx.fillStyle = lin(ctx, `fl:${y}:${len}:${cool}`, 0, y, 0, y + len, [
    [0, cool],
    [1, 'rgba(255,120,40,0)'],
  ]);
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x, y + f * 1.1, x + w, y);
  ctx.closePath();
  ctx.fill();
  // 심지
  ctx.fillStyle = hot;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.42, y);
  ctx.quadraticCurveTo(x, y + f * 0.55, x + w * 0.42, y);
  ctx.closePath();
  ctx.fill();
}

/** 플레이어 전투기 — 후퇴익 인터셉터 */
export function drawPlayerShip(ctx: Ctx, t: number) {
  // 엔진 불꽃 (기체 뒤쪽)
  flame(ctx, -7, 12, 4.5, 20, t);
  flame(ctx, 7, 12, 4.5, 20, t);

  // 주익
  ctx.fillStyle = lin(ctx, 'p:wing', -22, 0, 22, 0, [
    [0, '#0a8f77'], [0.5, '#19e8bd'], [1, '#0a8f77'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(21, 10);
  ctx.lineTo(13, 14);
  ctx.lineTo(0, 8);
  ctx.lineTo(-13, 14);
  ctx.lineTo(-21, 10);
  ctx.closePath();
  ctx.fill();

  // 미익
  ctx.fillStyle = '#0d9c84';
  ctx.beginPath();
  ctx.moveTo(-9, 8);
  ctx.lineTo(-12, 17);
  ctx.lineTo(-4, 13);
  ctx.closePath();
  ctx.moveTo(9, 8);
  ctx.lineTo(12, 17);
  ctx.lineTo(4, 13);
  ctx.closePath();
  ctx.fill();

  // 동체
  ctx.fillStyle = lin(ctx, 'p:body', -6, 0, 6, 0, [
    [0, '#7ffbe2'], [0.45, '#e8fffa'], [1, '#3fd8b6'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, -21);
  ctx.quadraticCurveTo(6.5, -8, 6, 14);
  ctx.lineTo(-6, 14);
  ctx.quadraticCurveTo(-6.5, -8, 0, -21);
  ctx.closePath();
  ctx.fill();

  // 캐노피
  ctx.fillStyle = '#0b2b3d';
  ctx.beginPath();
  ctx.ellipse(0, -7, 3.4, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,240,255,.55)';
  ctx.beginPath();
  ctx.ellipse(-1.1, -9, 1.3, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // 기수 발광
  ctx.fillStyle = '#aefff0';
  ctx.beginPath();
  ctx.arc(0, -19, 1.9, 0, Math.PI * 2);
  ctx.fill();

  // 익단등
  ctx.fillStyle = Math.floor(t * 4) % 2 ? '#ff5f9e' : '#ffd700';
  ctx.fillRect(-21.5, 8.5, 2.5, 2.5);
  ctx.fillRect(19, 8.5, 2.5, 2.5);
}

/** 잡몹 A — 각진 외계 요격기 (사인파 편대) */
export function drawInterceptor(ctx: Ctx, t: number, r: number) {
  if (enemyFood(ctx, 'mandu', t, r, 1)) return;   // 잡몹 A — 만두 편대
  const s = r / 18;
  ctx.scale(s, s);
  flame(ctx, 0, -14, 4, 12, t + 1, '#ffd9ec', '#ff5f9e');

  // 날개
  ctx.fillStyle = lin(ctx, 'i:wing', -20, 0, 20, 0, [
    [0, '#7d1f45'], [0.5, '#ff5f9e'], [1, '#7d1f45'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.lineTo(19, -8);
  ctx.lineTo(11, -12);
  ctx.lineTo(0, -4);
  ctx.lineTo(-11, -12);
  ctx.lineTo(-19, -8);
  ctx.closePath();
  ctx.fill();

  // 동체
  ctx.fillStyle = '#ff88b8';
  ctx.beginPath();
  ctx.moveTo(0, 17);
  ctx.quadraticCurveTo(6, 2, 5, -12);
  ctx.lineTo(-5, -12);
  ctx.quadraticCurveTo(-6, 2, 0, 17);
  ctx.closePath();
  ctx.fill();

  // 외눈 캐노피
  ctx.fillStyle = '#2a0716';
  ctx.beginPath();
  ctx.ellipse(0, 3, 3.6, 5.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.ellipse(0, 3.6, 1.7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // 캐넌
  ctx.fillStyle = '#5e1633';
  ctx.fillRect(-8.5, 8, 2.6, 8);
  ctx.fillRect(5.9, 8, 2.6, 8);
}

/** 잡몹 B — 회전 링을 두른 원반 (나선 편대) */
export function drawSaucer(ctx: Ctx, t: number, r: number) {
  if (enemyFood(ctx, 'coinbread', t, r, 1)) return;  // 잡몹 B — 회전하는 10원빵
  const s = r / 17;
  ctx.scale(s, s);

  // 하부 글로우
  ctx.fillStyle = rad(ctx, 's:under', 0, 6, 1, 0, 6, 17, [
    [0, 'rgba(110,168,255,.5)'], [1, 'rgba(110,168,255,0)'],
  ]);
  ctx.beginPath();
  ctx.ellipse(0, 7, 17, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 원반 본체
  ctx.fillStyle = '#3f6dbd';
  ctx.beginPath();
  ctx.ellipse(0, 2, 17, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lin(ctx, 's:disc', 0, -6, 0, 8, [
    [0, '#9fc6ff'], [0.55, '#3f6dbd'], [1, '#1b3a6e'],
  ]);
  ctx.beginPath();
  ctx.ellipse(0, 0.5, 16, 5.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 돔
  ctx.fillStyle = rad(ctx, 's:dome', -2.5, -5, 0.6, 0, -3, 9, [
    [0, '#eaf3ff'], [1, '#3f6dbd'],
  ]);
  ctx.beginPath();
  ctx.ellipse(0, -2.5, 8, 7, 0, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,60,.75)';
  ctx.beginPath();
  ctx.ellipse(0, -3.4, 4.4, 3.6, 0, Math.PI, 0);
  ctx.fill();

  // 회전하는 하부 라이트 6개
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI * 2 * i) / 6 + t * 1.6;
    const lx = Math.cos(a) * 12.5;
    const ly = Math.sin(a) * 4.4 + 2.5;
    const lit = Math.sin(a) > 0; // 앞쪽 라이트만 밝게
    ctx.fillStyle = lit ? '#bfe0ff' : '#20386a';
    ctx.beginPath();
    ctx.arc(lx, ly, 1.7, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** 돌진병 — 카미카제 다트 (진행 방향으로 회전된 상태로 호출) */
export function drawDart(ctx: Ctx, t: number, r: number) {
  if (enemyFood(ctx, 'hotdog', t, r, 3, Math.PI / 2)) return;  // 돌진병 — 궤적까지 남겨 '날아오는 것'으로 읽히게
  const s = r / 13;
  ctx.scale(s, s);
  flame(ctx, 0, -11, 3.4, 14, t + 2, '#fff0d0', '#ff6a1f');

  // 핀
  ctx.fillStyle = '#8a3c0f';
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.lineTo(-9, -12);
  ctx.lineTo(-3, -1);
  ctx.closePath();
  ctx.moveTo(3, -6);
  ctx.lineTo(9, -12);
  ctx.lineTo(3, -1);
  ctx.closePath();
  ctx.fill();

  // 탄두
  ctx.fillStyle = lin(ctx, 'd:body', -4, 0, 4, 0, [
    [0, '#ffb37a'], [0.5, '#ff8f4a'], [1, '#c25a1c'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.quadraticCurveTo(4.6, 2, 4, -9);
  ctx.lineTo(-4, -9);
  ctx.quadraticCurveTo(-4.6, 2, 0, 15);
  ctx.closePath();
  ctx.fill();

  // 경고등 점멸
  ctx.fillStyle = Math.floor(t * 9) % 2 ? '#ff2d2d' : '#5a0f0f';
  ctx.beginPath();
  ctx.arc(0, 5, 2.1, 0, Math.PI * 2);
  ctx.fill();
}

/** 미사일 발사기 — 중장갑 건십 */
export function drawGunship(ctx: Ctx, t: number, r: number) {
  if (enemyFood(ctx, 'cupramyeon', t, r, 2)) return;  // 발사기 — 컵라면
  const s = r / 22;
  ctx.scale(s, s);
  flame(ctx, -11, -16, 3.4, 10, t + 0.7, '#ffe9c2', '#ffb03a');
  flame(ctx, 11, -16, 3.4, 10, t + 1.4, '#ffe9c2', '#ffb03a');

  // 측면 미사일 포드
  ctx.fillStyle = '#6d4a12';
  ctx.fillRect(-22, -6, 8, 18);
  ctx.fillRect(14, -6, 8, 18);
  ctx.fillStyle = '#2a1c05';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(-20.5, 8 - i * 5.5, 5, 3.4);
    ctx.fillRect(15.5, 8 - i * 5.5, 5, 3.4);
  }

  // 동체
  ctx.fillStyle = lin(ctx, 'g:body', -14, 0, 14, 0, [
    [0, '#a5761d'], [0.45, '#ffd483'], [1, '#a5761d'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.lineTo(13, 8);
  ctx.lineTo(13, -13);
  ctx.lineTo(-13, -13);
  ctx.lineTo(-13, 8);
  ctx.closePath();
  ctx.fill();

  // 장갑 라인
  ctx.strokeStyle = 'rgba(60,38,4,.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.lineTo(13, -2);
  ctx.moveTo(-8, -13);
  ctx.lineTo(-8, 11);
  ctx.moveTo(8, -13);
  ctx.lineTo(8, 11);
  ctx.stroke();

  // 센서 아이
  ctx.fillStyle = '#2a1c05';
  ctx.beginPath();
  ctx.ellipse(0, 8, 6.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = Math.floor(t * 3) % 2 ? '#ff5f5f' : '#ffae4d';
  ctx.beginPath();
  ctx.ellipse(0, 8, 3.4, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** 중간보스 — 장갑 순양함 */
export function drawCruiser(ctx: Ctx, t: number, r: number) {
  if (enemyFood(ctx, 'tteokbokki', t, r, 2)) return;  // 중간보스 — 떡볶이 한 그릇
  const s = r / 40;
  ctx.scale(s, s);
  flame(ctx, -18, -30, 6, 18, t + 0.3, '#efe0ff', '#b09aff');
  flame(ctx, 18, -30, 6, 18, t + 0.9, '#efe0ff', '#b09aff');

  // 하부 캐넌 암
  ctx.fillStyle = '#4b3a80';
  ctx.beginPath();
  ctx.moveTo(-38, -4);
  ctx.lineTo(-22, -12);
  ctx.lineTo(-20, 16);
  ctx.lineTo(-31, 24);
  ctx.closePath();
  ctx.moveTo(38, -4);
  ctx.lineTo(22, -12);
  ctx.lineTo(20, 16);
  ctx.lineTo(31, 24);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#241a45';
  ctx.fillRect(-32, 18, 7, 12);
  ctx.fillRect(25, 18, 7, 12);

  // 주 선체
  ctx.fillStyle = lin(ctx, 'c:hull', -24, 0, 24, 0, [
    [0, '#5b47a0'], [0.42, '#cdbcff'], [1, '#5b47a0'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, 34);
  ctx.lineTo(20, 16);
  ctx.lineTo(24, -14);
  ctx.lineTo(12, -28);
  ctx.lineTo(-12, -28);
  ctx.lineTo(-24, -14);
  ctx.lineTo(-20, 16);
  ctx.closePath();
  ctx.fill();

  // 장갑판
  ctx.strokeStyle = 'rgba(40,26,80,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-21, 2);
  ctx.lineTo(21, 2);
  ctx.moveTo(-16, -16);
  ctx.lineTo(16, -16);
  ctx.stroke();

  // 코어 (맥동은 스케일로 처리해 그라디언트를 재사용)
  ctx.save();
  ctx.translate(0, 12);
  ctx.scale(1 + Math.sin(t * 5) * 0.12, 1 + Math.sin(t * 5) * 0.12);
  ctx.fillStyle = rad(ctx, 'c:core', 0, 0, 1, 0, 0, 13, [
    [0, '#fff'], [0.35, '#ff8ec2'], [1, 'rgba(255,95,158,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#1b1233';
  ctx.beginPath();
  ctx.arc(0, 12, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff5f9e';
  ctx.beginPath();
  ctx.arc(0, 12, 3.6, 0, Math.PI * 2);
  ctx.fill();
}

/** 최종보스 — 전함. phase(1~3)에 따라 색이 달아오른다 */
export function drawDreadnought(ctx: Ctx, t: number, r: number, phase: number) {
  if (foodInCircle(ctx, 'buldak', r)) { dreadAura(ctx, t, r, phase); return; }  // 최종보스 — 불닭
  const s = r / 52;
  ctx.scale(s, s);
  const tint = phase === 1 ? '#ff5f9e' : phase === 2 ? '#ff8f4a' : '#ff3b3b';
  const lite = phase === 1 ? '#ffc2dc' : phase === 2 ? '#ffd7ac' : '#ffb3b3';

  // 엔진 4기
  for (const ex of [-30, -12, 12, 30]) flame(ctx, ex, -38, 6, 20, t + ex * 0.05, '#fff', tint);

  // 외곽 윙
  ctx.fillStyle = lin(ctx, `f:wing:${phase}`, -60, 0, 60, 0, [
    [0, '#3a1730'], [0.5, tint], [1, '#3a1730'],
  ]);
  ctx.beginPath();
  ctx.moveTo(-26, -22);
  ctx.lineTo(-58, 2);
  ctx.lineTo(-52, 26);
  ctx.lineTo(-22, 14);
  ctx.closePath();
  ctx.moveTo(26, -22);
  ctx.lineTo(58, 2);
  ctx.lineTo(52, 26);
  ctx.lineTo(22, 14);
  ctx.closePath();
  ctx.fill();

  // 윙 포탑
  ctx.fillStyle = '#2b0f24';
  ctx.fillRect(-52, 20, 9, 16);
  ctx.fillRect(43, 20, 9, 16);
  ctx.fillStyle = lite;
  ctx.fillRect(-50, 33, 5, 4);
  ctx.fillRect(45, 33, 5, 4);

  // 주 선체
  ctx.fillStyle = lin(ctx, 'f:hull', -30, 0, 30, 0, [
    [0, '#4a1c3c'], [0.4, '#ffe3f0'], [0.62, '#e7a9c8'], [1, '#4a1c3c'],
  ]);
  ctx.beginPath();
  ctx.moveTo(0, 46);
  ctx.lineTo(24, 26);
  ctx.lineTo(30, -16);
  ctx.lineTo(16, -36);
  ctx.lineTo(-16, -36);
  ctx.lineTo(-30, -16);
  ctx.lineTo(-24, 26);
  ctx.closePath();
  ctx.fill();

  // 장갑 홈
  ctx.strokeStyle = 'rgba(50,12,36,.55)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    ctx.moveTo(i * 11, -34);
    ctx.lineTo(i * 11, 24);
  }
  ctx.stroke();

  // 전방 캐넌 2문
  ctx.fillStyle = '#2b0f24';
  ctx.fillRect(-17, 30, 8, 18);
  ctx.fillRect(9, 30, 8, 18);
  ctx.fillStyle = lite;
  ctx.fillRect(-15.5, 44, 5, 5);
  ctx.fillRect(10.5, 44, 5, 5);

  // 중앙 코어 (페이즈가 오를수록 크게 맥동 — 스케일로 처리)
  const pulse = 1 + (Math.sin(t * (3 + phase * 2)) * (2 + phase)) / 26;
  ctx.save();
  ctx.translate(0, 8);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = rad(ctx, `f:core:${phase}`, 0, 0, 2, 0, 0, 26, [
    [0, '#ffffff'], [0.3, lite], [0.62, tint], [1, 'rgba(0,0,0,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#1a0410';
  ctx.beginPath();
  ctx.arc(0, 8, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(0, 8, 6 + Math.sin(t * 8) * 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 함교
  ctx.fillStyle = '#2b0f24';
  ctx.beginPath();
  ctx.moveTo(0, -38);
  ctx.lineTo(11, -26);
  ctx.lineTo(-11, -26);
  ctx.closePath();
  ctx.fill();
}

/** 무기 강화 아이템 — 회전 링을 두른 발광 캡슐 */
export function drawPowerCapsule(ctx: Ctx, t: number) {
  ctx.fillStyle = rad(ctx, 'pw:glow', 0, 0, 1, 0, 0, 22, [
    [0, 'rgba(0,255,200,.55)'], [1, 'rgba(0,255,200,0)'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();

  // 바깥 회전 링 (타원 회전으로 3D 느낌)
  ctx.strokeStyle = '#00ffc8';
  ctx.lineWidth = 2;
  ctx.save();
  ctx.rotate(t * 2.4);
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 6.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 코어
  ctx.fillStyle = lin(ctx, 'pw:core', 0, -11, 0, 11, [
    [0, '#eafff9'], [1, '#00c99c'],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#04372c';
  ctx.font = 'bold 13px Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('P', 0, 0.5);
  ctx.textBaseline = 'alphabetic';
}


/**
 * 최종보스 페이즈 연출 — 스프라이트 위에 겹치는 열기.
 * 봉지 그림 자체는 안 변하므로, 페이즈는 **테두리 불꽃 고리**로 읽히게 한다.
 * 플레이어가 지금 몇 페이즈인지 한눈에 알아야 패턴에 대응할 수 있다.
 */
function dreadAura(ctx: Ctx, t: number, r: number, phase: number) {
  const p = Math.min(3, Math.max(1, phase));
  const heat = [0, 0.45, 0.8, 1.2][p];
  const col = ['', '255,180,60', '255,110,30', '255,50,20'][p];
  const pulse = 1 + Math.sin(t * (2 + p * 1.6)) * 0.05 * p;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // 바깥 열기
  ctx.fillStyle = rad(ctx, `dread:${p}`, 0, 0, r * 0.55, 0, 0, r * 1.5, [
    [0, `rgba(${col},${heat * 0.34})`],
    [0.55, `rgba(${col},${heat * 0.16})`],
    [1, `rgba(${col},0)`],
  ]);
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.5 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // 페이즈 고리 — 개수로도 구분되게 (1개 / 2개 / 3개)
  ctx.strokeStyle = `rgba(${col},${0.55 + 0.15 * p})`;
  for (let i = 0; i < p; i++) {
    ctx.lineWidth = 2.6 - i * 0.5;
    ctx.beginPath();
    ctx.arc(0, 0, (r * 1.06 + i * 7) * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 3페이즈에서는 불티가 튄다
  if (p === 3) {
    ctx.fillStyle = 'rgba(255,220,120,.85)';
    for (let i = 0; i < 7; i++) {
      const a = t * 1.7 + i * 0.9;
      const d = r * (1.1 + ((i * 0.13 + t * 0.35) % 0.45));
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

