/**
 * 네온 러너 — 리듬형 콤보 러너 엔진
 * 조작: 스페이스바(점프/2단점프), ↓(숙이기/급강하), M(음소거)
 */
import { sound, type Pattern } from '../lib/sound';
import { gradeOf, saveScore, getBest, KEYS, type Grade } from '../lib/score';
import { drawRunner, drawSpeedLines, drawCrate, drawDrone, drawCeiling } from './runnerSprites';
import { Quality } from '../lib/perf';

/* ===== 설정 (부스 운영 중 조정 가능) ===== */
const CONFIG = {
  grades: [
    { min: 2500, label: 'S', color: '#ffd700', msg: '전설의 러너!' },
    { min: 1600, label: 'A', color: '#ff5f9e', msg: '대단해요!' },
    { min: 900, label: 'B', color: '#00ffc8', msg: '잘했어요!' },
    { min: 400, label: 'C', color: '#6ea8ff', msg: '좋아요!' },
    { min: 0, label: 'D', color: '#8892a6', msg: '다시 도전!' },
  ] as Grade[],
  baseSpeed: 400,
  maxSpeed: 980,
  accel: 13,
  gravity: 3200,
  jumpVel: -1050,
  jumpVel2: -950,
  fastFall: 1500,
};

/* ===== BGM — A 마이너 펜타토닉, 속도에 비례해 템포 상승 ===== */
const BGM: Pattern = {
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
  bass: [110, 0, 110, 0, 131, 0, 110, 0, 98, 0, 98, 0, 87, 0, 98, 0],
  lead: [440, 0, 0, 523, 0, 0, 587, 0, 0, 659, 0, 0, 587, 0, 523, 0, 440, 0, 0, 392, 0, 0, 440, 0, 0, 523, 0, 0, 440, 0, 392, 0],
};

const SFX = {
  jump: () => sound.tone({ f: 330, f2: 660, dur: 0.12, vol: 0.22 }),
  jump2: () => sound.tone({ f: 520, f2: 1100, dur: 0.12, vol: 0.22 }),
  fall: () => { sound.tone({ f: 800, f2: 160, dur: 0.18, type: 'sawtooth', vol: 0.14 }); sound.noise({ dur: 0.15, vol: 0.12, fc: 1400 }); },
  duck: () => sound.tone({ f: 190, f2: 150, dur: 0.06, type: 'triangle', vol: 0.2 }),
  land: () => sound.tone({ f: 130, f2: 90, dur: 0.07, type: 'sine', vol: 0.25 }),
  mile: () => { sound.tone({ f: 880, dur: 0.07, vol: 0.12 }); sound.tone({ f: 1320, dur: 0.09, vol: 0.12, when: 0.07 }); },
  crash: () => { sound.noise({ dur: 0.45, vol: 0.45, fc: 900 }); sound.tone({ f: 260, f2: 45, dur: 0.5, type: 'sawtooth', vol: 0.3 }); },
};

function gradeJingle(label: string) {
  const seq: Record<string, number[]> = {
    S: [523, 659, 784, 1047, 1319], A: [523, 659, 784, 1047], B: [523, 659, 784], C: [440, 554], D: [330, 262],
  };
  (seq[label] ?? seq.D).forEach((f, i) => sound.tone({ f, dur: 0.16, vol: 0.18, when: 0.5 + i * 0.13 }));
}

/* ===== 장애물 패턴 =====
 * 리듬게임처럼 "동작 콤보"를 하나의 패턴으로 스폰.
 *  block: 점프 | tall: 2단 점프 | drone: 숙이기 | droneHigh: 페이크 | ceil: 구간 내내 숙이기
 * dx는 기준 간격(px). 실제 간격은 속도에 비례 확대되어 동작 사이
 * 시간 간격(dx/baseSpeed ≈ 0.3~0.45초)이 일정하게 유지됨.
 */
type ObsKind = 'block' | 'tall' | 'drone' | 'droneHigh' | 'ceil';
interface PatternStep { dx: number; k: ObsKind; len?: number }

const PATTERNS: Record<number, PatternStep[][]> = {
  1: [
    [{ dx: 0, k: 'block' }],
    [{ dx: 0, k: 'drone' }],
    [{ dx: 0, k: 'ceil' }],
    [{ dx: 0, k: 'block' }, { dx: 180, k: 'block' }],
    [{ dx: 0, k: 'droneHigh' }, { dx: 160, k: 'block' }],
  ],
  2: [
    [{ dx: 0, k: 'block' }, { dx: 195, k: 'drone' }],
    [{ dx: 0, k: 'drone' }, { dx: 195, k: 'block' }],
    [{ dx: 0, k: 'tall' }],
    [{ dx: 0, k: 'ceil', len: 230 }],
    [{ dx: 0, k: 'block' }, { dx: 160, k: 'block' }, { dx: 320, k: 'block' }],
    [{ dx: 0, k: 'drone' }, { dx: 170, k: 'droneHigh' }, { dx: 320, k: 'block' }],
  ],
  3: [
    [{ dx: 0, k: 'block' }, { dx: 165, k: 'drone' }, { dx: 340, k: 'block' }],
    [{ dx: 0, k: 'tall' }, { dx: 260, k: 'ceil' }],
    [{ dx: 0, k: 'drone' }, { dx: 155, k: 'drone' }],
    [{ dx: 0, k: 'ceil', len: 260 }, { dx: 370, k: 'block' }],
    [{ dx: 0, k: 'block' }, { dx: 150, k: 'tall' }],
    [{ dx: 0, k: 'drone' }, { dx: 175, k: 'block' }, { dx: 330, k: 'drone' }],
    [{ dx: 0, k: 'block' }, { dx: 155, k: 'block' }, { dx: 310, k: 'drone' }, { dx: 470, k: 'block' }],
  ],
};

interface Obstacle { x: number; y: number; w: number; h: number; type: 'block' | 'tall' | 'drone' | 'ceil'; t?: number }

export function createRunner(cv: HTMLCanvasElement): () => void {
  const W = 960, H = 420;
  const ctx = cv.getContext('2d', { alpha: false })!;
  const fit = Math.min(1, (innerWidth - 40) / W);
  const quality = new Quality(cv, ctx, W, H, fit);
  let showFps = false;

  const GROUND_Y = H - 70;
  const KEY = KEYS.runner;

  /* ===== 상태 ===== */
  let state: 'ready' | 'play' | 'over' = 'ready';
  let score = 0, speed = 0, distSinceSpawn = 0, nextGap = 0, overTime = 0, lastMile = 0;
  let downHeld = false;
  const player = { x: 150, y: GROUND_Y, vy: 0, w: 40, h: 52, duck: false, onGround: true, jumpsLeft: 2, legT: 0 };
  let obstacles: Obstacle[] = [];
  let best = getBest(KEY);
  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W, y: Math.random() * (GROUND_Y - 40),
    s: Math.random() * 1.8 + 0.4, spd: Math.random() * 0.5 + 0.15,
  }));

  function reset() {
    score = 0; speed = CONFIG.baseSpeed;
    player.y = GROUND_Y; player.vy = 0; player.duck = false; player.onGround = true; player.jumpsLeft = 2;
    obstacles = []; distSinceSpawn = 0; nextGap = 420; lastMile = 0;
    sound.startMusic(BGM, () => 116 + speed * 0.05);
    state = 'play';
  }

  /* ===== 입력 ===== */
  function jump() {
    sound.ensure();
    if (state === 'ready') { reset(); return; }
    if (state === 'over') { if (performance.now() - overTime > 800) reset(); return; }
    if (player.jumpsLeft > 0) {
      const first = player.onGround;
      player.vy = first ? CONFIG.jumpVel : CONFIG.jumpVel2;
      player.onGround = false;
      player.jumpsLeft--;
      player.duck = false;
      first ? SFX.jump() : SFX.jump2();
    }
  }

  const ac = new AbortController();
  const opts = { signal: ac.signal };
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) jump();
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      if (!e.repeat && state === 'play') {
        if (!player.onGround) { player.vy = Math.max(player.vy, CONFIG.fastFall); SFX.fall(); }
        else SFX.duck();
      }
      downHeld = true;
    }
    if (e.code === 'KeyM' && !e.repeat) sound.toggleMute();
    if (e.code === 'KeyF' && !e.repeat) showFps = !showFps;
  }, opts);
  window.addEventListener('keyup', e => { if (e.code === 'ArrowDown') downHeld = false; }, opts);
  cv.addEventListener('pointerdown', jump, opts);

  /* ===== 스폰 ===== */
  function makeObstacle(k: ObsKind, x: number, len?: number): Obstacle {
    if (k === 'block') return { x, y: GROUND_Y, w: 30 + Math.random() * 16, h: 46 + Math.random() * 14, type: 'block' };
    if (k === 'tall') return { x, y: GROUND_Y, w: 30, h: 140, type: 'tall' };
    if (k === 'drone') return { x, y: GROUND_Y - 58, w: 46, h: 26, type: 'drone', t: Math.random() * 6.28 };
    if (k === 'droneHigh') return { x, y: GROUND_Y - 100, w: 46, h: 26, type: 'drone', t: Math.random() * 6.28 };
    return { x, y: GROUND_Y - 46, w: len ?? 180, h: 64, type: 'ceil' };
  }

  function spawnPattern() {
    const tier = speed < 500 ? 1 : speed < 680 ? 2 : 3;
    const pool = Math.random() < 0.25 && tier > 1 ? PATTERNS[tier - 1] : PATTERNS[tier];
    const pat = pool[Math.floor(Math.random() * pool.length)];
    // 속도에 비례해 간격 확대 → 동작 간 시간 간격 유지
    const mult = speed / CONFIG.baseSpeed;
    let width = 0;
    for (const p of pat) {
      const o = makeObstacle(p.k, W + 40 + p.dx * mult, p.len);
      obstacles.push(o);
      width = Math.max(width, p.dx * mult + o.w);
    }
    nextGap = width + speed * (0.55 + Math.random() * 0.3); // 패턴 사이 숨 고르기
  }

  /* ===== 업데이트 ===== */
  function update(dt: number) {
    if (state !== 'play') {
      stars.forEach(s => { s.x -= s.spd * 30 * dt; if (s.x < 0) s.x = W; });
      return;
    }
    speed = Math.min(CONFIG.maxSpeed, speed + CONFIG.accel * dt);
    score += speed * dt * 0.05;

    const mile = Math.floor(score / 100);
    if (mile > lastMile) { lastMile = mile; SFX.mile(); }

    player.vy += CONFIG.gravity * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND_Y) {
      if (!player.onGround) SFX.land();
      player.y = GROUND_Y; player.vy = 0;
      player.onGround = true; player.jumpsLeft = 2;
    }
    player.duck = downHeld && player.onGround;
    player.legT += dt * (speed / 40);

    distSinceSpawn += speed * dt;
    if (distSinceSpawn >= nextGap) { distSinceSpawn = 0; spawnPattern(); }
    obstacles.forEach(o => { o.x -= speed * dt; if (o.type === 'drone') o.t! += dt * 4; });
    obstacles = obstacles.filter(o => o.x + o.w > -60);
    stars.forEach(s => { s.x -= s.spd * speed * 0.12 * dt; if (s.x < 0) s.x = W; });

    // 충돌 (AABB, 히트박스 축소로 억울한 죽음 방지)
    const ph = player.duck ? 28 : player.h;
    const px = player.x - player.w / 2 + 6, py = player.y - ph + 4;
    const pw = player.w - 12, phh = ph - 8;
    for (const o of obstacles) {
      let oy: number, oh: number;
      if (o.type === 'drone') { oy = o.y + Math.sin(o.t!) * 6; oh = o.h; }
      else if (o.type === 'ceil') { oy = o.y - o.h; oh = o.h; }
      else { oy = o.y - o.h; oh = o.h - 4; }
      const ox = o.x + 4, ow = o.w - 8;
      if (px < ox + ow && px + pw > ox && py < oy + oh && py + phh > oy) {
        state = 'over'; overTime = performance.now();
        best = saveScore(KEY, Math.floor(score), CONFIG.grades);
        sound.stopMusic(); SFX.crash(); gradeJingle(gradeOf(CONFIG.grades, Math.floor(score)).label);
        break;
      }
    }
  }

  /* ===== 그리기 ===== */
  function drawPlayer() {
    // 착지 그림자 (높이 오를수록 작고 옅게)
    const airH = Math.max(0, GROUND_Y - player.y);
    const k = Math.max(0, 1 - airH / 190);
    ctx.fillStyle = `rgba(0,255,200,${0.16 * k})`;
    ctx.beginPath();
    ctx.ellipse(player.x, GROUND_Y + 3, 20 * k + 6, 4.5 * k + 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(player.x, player.y);
    drawRunner(ctx, {
      duck: player.duck,
      onGround: player.onGround,
      running: state === 'play',
      legT: player.legT,
      vy: player.vy,
    });
    ctx.restore();
  }

  function drawObstacle(o: Obstacle) {
    if (o.type === 'drone') drawDrone(ctx, o.x, o.y + Math.sin(o.t!) * 6, o.w, o.h, o.t!);
    else if (o.type === 'ceil') drawCeiling(ctx, o.x, o.y, o.w, o.h);
    else drawCrate(ctx, o.x, o.y, o.w, o.h, o.type === 'tall');
  }

  function draw() {
    // alpha:false 컨텍스트라 배경을 직접 칠한다
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#3a4a6a';
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.s, s.s));

    ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 1); ctx.lineTo(W, GROUND_Y + 1); ctx.stroke();
    ctx.fillStyle = '#1a2238';
    const off = (score * 12) % 46;
    for (let x = -off; x < W; x += 46) ctx.fillRect(x, GROUND_Y + 8, 24, 3);

    obstacles.forEach(drawObstacle);
    if (state === 'play' && !quality.low) drawSpeedLines(ctx, player.x, player.y, speed, score * 0.02);
    drawPlayer();

    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 26px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(score)).padStart(6, '0'), W - 24, 44);
    ctx.fillStyle = '#556';
    ctx.font = '14px Consolas, monospace';
    ctx.fillText('BEST ' + String(best).padStart(6, '0'), W - 24, 66);
    ctx.fillStyle = '#445';
    ctx.fillText('M: 소리 ' + (sound.muted ? 'OFF' : 'ON'), W - 24, H - 16);
    if (showFps) ctx.fillText(quality.fps.toFixed(0) + ' FPS · x' + quality.scale.toFixed(1), W - 24, H - 32);

    if (state === 'ready') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00ffc8';
      ctx.font = 'bold 42px "Malgun Gothic", sans-serif';
      ctx.fillText('네온 러너', W / 2, H / 2 - 80);
      ctx.fillStyle = '#e8f0ff';
      ctx.font = '19px "Malgun Gothic", sans-serif';
      ctx.fillText('스페이스바: 점프 (공중에서 한 번 더 = 2단 점프)', W / 2, H / 2 - 28);
      ctx.fillText('↓: 숙이기 · 공중에서 ↓ = 급강하', W / 2, H / 2 + 4);
      ctx.fillStyle = '#8892a6';
      ctx.fillText('스페이스바를 눌러 시작', W / 2, H / 2 + 52);
    }

    if (state === 'over') {
      const g = gradeOf(CONFIG.grades, Math.floor(score));
      ctx.fillStyle = 'rgba(10,10,18,.82)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color; ctx.shadowBlur = 30;
      ctx.font = 'bold 130px "Segoe UI", sans-serif';
      ctx.fillText(g.label, W / 2, H / 2 + 10);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 26px "Malgun Gothic", sans-serif';
      ctx.fillText(g.msg, W / 2, H / 2 + 55);
      ctx.fillStyle = '#e8f0ff';
      ctx.font = 'bold 30px Consolas, monospace';
      ctx.fillText('SCORE  ' + Math.floor(score), W / 2, H / 2 - 105);
      ctx.fillStyle = '#8892a6';
      ctx.font = '17px "Malgun Gothic", sans-serif';
      ctx.fillText('스페이스바를 눌러 재시작', W / 2, H - 46);
    }
  }

  /* ===== 메인 루프 ===== */
  let rafId = 0;
  let last = performance.now();
  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    quality.tick(dt);
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  return () => {
    ac.abort();
    cancelAnimationFrame(rafId);
    sound.stopMusic();
  };
}
