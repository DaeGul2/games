/**
 * K-푸드 사격 — 원근 도로를 달리며 쏘는 자동 발사 슈팅
 *
 * 조작은 **좌우뿐**이다. 전진도 발사도 알아서 한다.
 * 길 위에 떠내려오는 **K-푸드를 몸으로 주워** 세지고, 마주 오는 악당 부대를 젓가락으로 쓸어낸다.
 *
 * ── 좌표계
 *   세로 화면이 아니라 **깊이(z)** 로 다룬다. z=0이 저 멀리, z=1이 내 발치.
 *     원근율 p(z) = 1 / (1 + (1-z)·K)
 *     화면y = 지평선 + (바닥 - 지평선)·p
 *     화면x = 중앙 + 차선x · 도로반폭 · p
 *   덕분에 게임 로직은 1차원 그대로고(=수치 설계가 그대로 유효하다), 그림만 원근이 된다.
 *
 * ── 이 장르의 핵심은 두 곡선의 줄다리기다
 *     화력 ↑  vs  적 체력 ↑
 *   적 체력 기준선을 "평균적으로 주워 먹는 사람"의 화력에 맞췄다.
 *   부지런히 주우면 적이 녹고, 흘리면 못 죽인 적이 밀고 내려와 나를 때린다.
 *   **죽는 조건이 곧 화력 방정식**이다 — 수치는 arrowBalance.ts에 전부 모아 두었다.
 */
import { sound, type Pattern } from '../lib/sound';
import { gradeOf, saveScore, getBest, KEYS, type Grade } from '../lib/score';
import { Quality } from '../lib/perf';
import { drawSprite } from '../lib/sprites';
import { drawPerson, drawChopsticksHeld, PAL } from './arrowChars';
import {
  initialStats, dps, baseDps, damagePerArrow, shownArrows, rollItem, tickBuffs, effMul,
  enemyHp, enemyDamage, enemyScore, baselineDps, WAVE, ITEMS_PER_WAVE, MOVE_SPEED,
  type Stats, type Item, type EnemyKind,
} from './arrowBalance';

/* ===== 설정 ===== */
const CONFIG = {
  grades: [
    // 시뮬레이션 분포로 정했다 (초반 유예 3구간 반영 후).
    // 부스 손님 모델(반응 0.3초·오차 있음) 중앙 12,560 · 23구간 · 2분 53초
    // 요령파(아이템 최우선) 중앙 13,563 · 24구간 · 2분 57초
    { min: 40000, label: 'S', color: '#ffd700', msg: '전설의 사수!' },
    { min: 22000, label: 'A', color: '#ff5f9e', msg: '대단해요!' },
    { min: 12000, label: 'B', color: '#00ffc8', msg: '잘했어요!' },
    { min: 5000, label: 'C', color: '#6ea8ff', msg: '좋아요!' },
    { min: 0, label: 'D', color: '#8892a6', msg: '다시 도전!' },
  ] as Grade[],
};

/* 깊이 → 화면 */
const DEPTH_K = 8;
const persp = (z: number) => 1 / (1 + (1 - z) * DEPTH_K);

/* 속도 (깊이 단위/초) */
const SPEED = {
  arrow: -1.6,
  item: 0.24,
  grunt: 0.15,
  runner: 0.27,
  tank: 0.105,
  boss: 0.07,
};

/* ===== BGM ===== */
const BGM: Pattern = {
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  hat: [0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
  bass: [98, 0, 98, 0, 131, 0, 110, 0, 147, 0, 131, 0, 110, 0, 98, 0],
  lead: [587, 0, 0, 659, 0, 784, 0, 0, 659, 0, 587, 0, 0, 494, 0, 0],
};

const SFX = {
  shoot: () => sound.tone({ f: 1500, f2: 900, dur: 0.03, vol: 0.026 }),
  kill: () => { sound.noise({ dur: 0.12, vol: 0.14, fc: 1500 }); sound.tone({ f: 320, f2: 100, dur: 0.12, type: 'sine', vol: 0.12 }); },
  pick: (big: boolean) => {
    const f = big ? 660 : 520;
    [0, 1, 2].forEach(i => sound.tone({ f: f * (1 + i * 0.26), dur: 0.09, vol: 0.17, when: i * 0.055 }));
  },
  jackpot: () => [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
    sound.tone({ f, dur: 0.13, vol: 0.22, when: i * 0.07 })),
  hurt: () => { sound.tone({ f: 240, f2: 80, dur: 0.28, type: 'sawtooth', vol: 0.3 }); sound.noise({ dur: 0.18, vol: 0.22, fc: 800 }); },
  boss: () => { for (let i = 0; i < 4; i++) sound.tone({ f: i % 2 ? 554 : 415, dur: 0.2, vol: 0.2, when: i * 0.24 }); },
  bossDown: () => { sound.noise({ dur: 0.9, vol: 0.45, fc: 700 }); sound.tone({ f: 160, f2: 32, dur: 0.9, type: 'sawtooth', vol: 0.3 }); },
  over: () => { sound.noise({ dur: 0.6, vol: 0.42, fc: 700 }); sound.tone({ f: 220, f2: 36, dur: 0.7, type: 'sawtooth', vol: 0.32 }); },
};

function gradeJingle(label: string) {
  const seq: Record<string, number[]> = {
    S: [523, 659, 784, 1047, 1319], A: [523, 659, 784, 1047], B: [523, 659, 784], C: [440, 554], D: [330, 262],
  };
  (seq[label] ?? seq.D).forEach((f, i) => sound.tone({ f, dur: 0.16, vol: 0.18, when: 0.5 + i * 0.13 }));
}

/** 큰 수는 줄여 쓴다 — 이 장르는 숫자가 금방 백만 단위가 된다 */
function fmt(n: number) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1) + '만';
  if (n >= 1000) return (n / 1000).toFixed(1) + '천';
  return String(Math.round(n));
}

/* ===== 개체 ===== */
interface Enemy {
  id: number; kind: EnemyKind;
  x: number; z: number;
  hp: number; maxHp: number;
  dmg: number; score: number;
  flash: number; atk: number;
  /** 걷는 모션 위상 */
  ph: number;
}
interface Arrow { x: number; z: number; dmg: number; pierce: number; hitIds: number[] }
interface Drop { item: Item; x: number; z: number; taken: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }
interface Popup { x: number; y: number; text: string; sub?: string; color: string; life: number; big?: boolean }

type State = 'ready' | 'play' | 'over';

export function createArrow(cv: HTMLCanvasElement): () => void {
  const W = 560, H = 760;
  const ctx = cv.getContext('2d', { alpha: false })!;
  const fit = Math.min(1, (innerWidth - 40) / W, Math.max(0.5, (innerHeight - 210) / H));
  const quality = new Quality(cv, ctx, W, H, fit);

  const CX = W / 2;
  const HORIZON = 150;
  const GROUND_Y = H - 74;      // 플레이어 발치
  const ROAD_HALF = 232;        // z=1에서 도로 반폭
  const KEY = KEYS.arrow;

  const sy = (z: number) => HORIZON + (GROUND_Y - HORIZON) * persp(z);
  const sx = (x: number, z: number) => CX + x * ROAD_HALF * persp(z);

  /* ===== 상태 ===== */
  let state: State = 'ready';
  let st: Stats = initialStats();
  let score = 0, best = getBest(KEY), wave = 0, kills = 0, picked = 0;
  let waveT = 0, runT = 0, scroll = 0;
  let px = 0, fireT = 0, hurtT = 0, shake = 0, overT = 0, walk = 0;
  let enemies: Enemy[] = [];
  let arrows: Arrow[] = [];
  let drops: Drop[] = [];
  const particles: Particle[] = [];
  const popups: Popup[] = [];
  let enemyId = 1, bossAlive = false, showFps = false;
  const held = new Set<string>();

  /* ===== 스폰 ===== */
  function spawnEnemy(kind: EnemyKind, x: number, z: number) {
    const hp = enemyHp(kind, wave);
    enemies.push({
      id: enemyId++, kind, x, z, hp, maxHp: hp,
      dmg: enemyDamage(kind, wave), score: enemyScore(kind, wave),
      flash: 0, atk: 0, ph: Math.random() * 6.28,
    });
  }

  function startWave() {
    wave++;
    waveT = 0;
    if (wave % WAVE.bossEvery === 0) {
      spawnEnemy('boss', 0, -0.15);
      bossAlive = true;
      SFX.boss();
      popups.push({ x: CX, y: 250, text: '보스 등장!', color: '#ff5f9e', life: 1.6, big: true });
    } else {
      // 부대처럼 줄 맞춰 내려온다
      const n = WAVE.count(wave);
      const rows = Math.ceil(n / 4);
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        const kind: EnemyKind = r < 0.2 && wave > 2 ? 'tank' : r < 0.55 ? 'runner' : 'grunt';
        const col = i % 4, row = (i / 4) | 0;
        spawnEnemy(kind, -0.72 + col * 0.48 + (Math.random() - 0.5) * 0.14,
          -0.08 - row * 0.13 - Math.random() * 0.05);
      }
      void rows;
    }
    // 아이템은 어느 구간이든 뿌린다 — 주우러 갈 이유가 계속 있어야 한다
    for (let i = 0; i < ITEMS_PER_WAVE; i++) {
      // 좌·우 번갈아, 가장자리 쪽에 — 가만히 있으면 못 줍고 움직여야 먹힌다.
      // 첫 구간의 첫 아이템만 도로 중앙에 — "주우면 세진다"를 조작 없이 알려주는 튜토리얼
      const side = i % 2 === 0 ? -1 : 1;
      const x = wave === 1 && i === 0 ? 0 : side * (0.45 + Math.random() * 0.4);
      drops.push({
        item: rollItem(),
        x,
        z: -0.05 - i * 0.3 - Math.random() * 0.12,
        taken: false,
      });
    }
  }

  /* ===== 효과 ===== */
  function burst(x: number, y: number, color: string, n: number, spd: number) {
    if (quality.low) n = Math.max(3, n >> 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const s = spd * (0.4 + Math.random() * 0.9);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.3, max: 0.65, color, r: 1.8 + Math.random() * 2.4 });
    }
  }

  function hurt(amount: number) {
    if (st.shield > 0) {
      st.shield--;
      popups.push({ x: sx(px, 1), y: GROUND_Y - 70, text: '보호막!', color: '#22c1c3', life: 0.9 });
      return;
    }
    st.hp -= amount;
    hurtT = 0.45;
    shake = 11;
    SFX.hurt();
    if (st.hp <= 0) { st.hp = 0; gameOver(); }
  }

  function gameOver() {
    state = 'over';
    overT = performance.now();
    sound.stopMusic();
    SFX.over();
    best = saveScore(KEY, score, CONFIG.grades);
    gradeJingle(gradeOf(CONFIG.grades, score).label);
  }

  function reset() {
    st = initialStats();
    score = 0; wave = 0; kills = 0; picked = 0; waveT = 0; runT = 0;
    px = 0; fireT = 0; hurtT = 0; shake = 0;
    enemies = []; arrows = []; drops = [];
    particles.length = 0; popups.length = 0;
    bossAlive = false;
    sound.startMusic(BGM, () => 128);
    state = 'play';
    startWave();
  }

  /* ===== 입력 ===== */
  const ac = new AbortController();
  const opts = { signal: ac.signal };

  function press() {
    sound.ensure();
    if (state === 'ready') { reset(); return; }
    if (state === 'over' && performance.now() - overT > 700) reset();
  }

  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    held.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space' || e.code === 'Enter') press();
    if (e.code === 'KeyM') sound.toggleMute();
    if (e.code === 'KeyF') showFps = !showFps;
    if (e.code === 'KeyR' && state === 'play') { sound.stopMusic(); state = 'ready'; }
  }, opts);
  window.addEventListener('keyup', e => held.delete(e.code), opts);
  window.addEventListener('blur', () => held.clear(), opts);

  function laneFromPointer(e: PointerEvent) {
    const r = cv.getBoundingClientRect();
    const cxPix = (e.clientX - r.left) / (r.width / W);
    return Math.max(-1, Math.min(1, (cxPix - CX) / ROAD_HALF));
  }
  cv.addEventListener('pointermove', e => { if (state === 'play') px = laneFromPointer(e); }, opts);
  cv.addEventListener('pointerdown', e => { if (state === 'play') px = laneFromPointer(e); press(); }, opts);

  /* ===== 업데이트 ===== */
  function update(dt: number) {
    scroll = (scroll + dt * 0.55) % 1;
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (hurtT > 0) hurtT -= dt;

    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      if (q.life <= 0) { particles.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt;
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt; popups[i].y -= 34 * dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }

    if (state !== 'play') return;
    runT += dt; waveT += dt;
    tickBuffs(st, dt);

    /* 좌우 이동 */
    if (held.has('ArrowLeft')) px -= MOVE_SPEED * dt;
    if (held.has('ArrowRight')) px += MOVE_SPEED * dt;
    px = Math.max(-1, Math.min(1, px));
    walk += dt * 9;

    /* 자동 발사 — 한 줄로 나간다 */
    fireT -= dt;
    if (fireT <= 0) {
      fireT = 1 / st.rate;
      const n = shownArrows(st);
      const dmg = damagePerArrow(st);
      const span = Math.min(1.5, 0.06 + n * 0.028);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        arrows.push({ x: px - span / 2 + span * t, z: 0.97, dmg, pierce: st.pierce, hitIds: [] });
      }
      SFX.shoot();
    }
    for (let i = arrows.length - 1; i >= 0; i--) {
      arrows[i].z += SPEED.arrow * dt;
      if (arrows[i].z < -0.25) arrows.splice(i, 1);
    }

    /* 적 전진 */
    const mul = WAVE.speedMul(wave);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.z += SPEED[e.kind] * mul * dt;
      e.ph += dt * 8;
      if (e.flash > 0) e.flash -= dt;
      if (e.kind === 'boss') {
        if (e.z > 0.82) {
          e.z = 0.82;
          e.atk -= dt;
          if (e.atk <= 0) { e.atk = 2.2; hurt(e.dmg); burst(sx(e.x, e.z), sy(e.z), '#ff5f9e', 16, 240); }
        }
      } else if (e.z >= 1) {
        enemies.splice(i, 1);
        hurt(e.dmg);
        burst(sx(e.x, 1), GROUND_Y - 30, '#ff5f9e', 14, 220);
      }
    }

    /* 명중 */
    for (let ai = arrows.length - 1; ai >= 0; ai--) {
      const a = arrows[ai];
      for (const e of enemies) {
        if (a.hitIds.includes(e.id)) continue;
        const halfZ = e.kind === 'boss' ? 0.06 : 0.03;
        const halfX = e.kind === 'boss' ? 0.34 : 0.13;
        if (Math.abs(a.z - e.z) > halfZ || Math.abs(a.x - e.x) > halfX) continue;
        a.hitIds.push(e.id);
        e.hp -= a.dmg;
        e.flash = 0.08;
        burst(sx(a.x, a.z), sy(a.z), '#ffe6a8', 2, 70);
        if (a.hitIds.length >= a.pierce) { arrows.splice(ai, 1); break; }
      }
    }

    /* 처치 */
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (e.hp > 0) continue;
      enemies.splice(i, 1);
      kills++;
      score += e.score;
      popups.push({ x: sx(e.x, e.z), y: sy(e.z) - 20, text: `+${fmt(e.score)}`, color: '#ffd700', life: 0.75 });
      if (e.kind === 'boss') { bossAlive = false; shake = 16; burst(sx(e.x, e.z), sy(e.z), '#ff6a2a', 44, 380); SFX.bossDown(); }
      else { burst(sx(e.x, e.z), sy(e.z), '#ffb03a', 10, 170); SFX.kill(); }
    }
    if (enemies.length === 0) bossAlive = false;

    /* 아이템 — 몸으로 주워야 먹힌다 */
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.z += SPEED.item * dt;
      if (!d.taken && d.z > 0.9 && Math.abs(d.x - px) < 0.15) {
        d.taken = true;
        d.item.apply(st);
        picked++;
        const jack = d.item.key === 'dx10';
        popups.push({
          x: sx(px, 1), y: GROUND_Y - 90,
          text: `${d.item.what} ${d.item.tag}`, color: d.item.color, life: jack ? 2 : 1.2, big: jack,
        });
        burst(sx(px, 1), GROUND_Y - 40, d.item.color, jack ? 40 : 18, jack ? 380 : 230);
        if (jack) { shake = 14; SFX.jackpot(); } else SFX.pick(d.item.tag.startsWith('×'));
        drops.splice(i, 1);
        continue;
      }
      if (d.z > 1.12) drops.splice(i, 1);
    }

    if (waveT > WAVE.time && !bossAlive) startWave();
  }

  /* ===== 그리기 ===== */
  function drawRoad() {
    // 하늘·먼 배경 (아주 조용하게)
    ctx.fillStyle = '#0d1018';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#141a26';
    ctx.fillRect(0, 0, W, HORIZON);

    const zTop = -0.3, zBot = 1;
    const yTop = sy(zTop), yBot = sy(zBot);
    const hTop = ROAD_HALF * persp(zTop), hBot = ROAD_HALF * persp(zBot);

    // 노면
    const g = ctx.createLinearGradient(0, yTop, 0, yBot);
    g.addColorStop(0, '#2a3040');
    g.addColorStop(1, '#3d4557');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(CX - hTop, yTop);
    ctx.lineTo(CX + hTop, yTop);
    ctx.lineTo(CX + hBot, yBot);
    ctx.lineTo(CX - hBot, yBot);
    ctx.closePath();
    ctx.fill();

    // 흐르는 가로 줄 — 전진하는 느낌
    for (let i = 0; i < 16; i++) {
      const z = ((i / 16) + scroll) % 1.3 - 0.3;
      if (z < zTop || z > 1) continue;
      const p = persp(z);
      const y = sy(z), h = ROAD_HALF * p;
      ctx.fillStyle = `rgba(255,255,255,${0.04 + p * 0.05})`;
      ctx.fillRect(CX - h, y, h * 2, Math.max(1, 5 * p));
    }
    // 가운데 차선
    ctx.strokeStyle = 'rgba(255,225,150,.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CX, yTop);
    ctx.lineTo(CX, yBot);
    ctx.stroke();

    // 난간
    for (const side of [-1, 1]) {
      ctx.strokeStyle = '#59627d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(CX + side * hTop, yTop);
      ctx.lineTo(CX + side * hBot, yBot);
      ctx.stroke();
      for (let i = 0; i < 14; i++) {
        const z = ((i / 14) + scroll * 0.5) % 1.3 - 0.3;
        if (z < zTop || z > 1) continue;
        const p = persp(z), y = sy(z), h = ROAD_HALF * p;
        ctx.fillStyle = `rgba(120,132,164,${0.25 + p * 0.5})`;
        ctx.fillRect(CX + side * h - 2, y - 26 * p, 4, 26 * p);
      }
    }
  }

  function drawPlayer() {
    const x = sx(px, 1), y = GROUND_Y;
    if (hurtT > 0 && Math.floor(hurtT * 20) % 2) ctx.globalAlpha = 0.45;
    // 발밑 표시
    ctx.strokeStyle = 'rgba(90,240,200,.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 17, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (st.shield > 0) {
      ctx.strokeStyle = `rgba(34,193,195,${0.5 + Math.sin(runT * 6) * 0.2})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(x, y - 24, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 요리사 — 등을 보이고 앞으로 달린다
    ctx.save();
    ctx.translate(x, y);
    drawPerson(ctx, 1.6, PAL.chef, walk, 1);
    drawChopsticksHeld(ctx, 1.6, runT);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawEnemy(e: Enemy) {
    const p = persp(e.z);
    const x = sx(e.x, e.z), y = sy(e.z);
    const s = (e.kind === 'boss' ? 4.4 : e.kind === 'tank' ? 2.0 : 1.5) * p * 3.4;
    const bulk = e.kind === 'boss' ? 1.35 : e.kind === 'tank' ? 1.3 : 1;
    ctx.save();
    ctx.translate(x, y);
    if (e.flash > 0) {
      // 피격 — 하얗게 번쩍
      ctx.filter = 'brightness(1.9)';
    }
    drawPerson(ctx, s, PAL[e.kind], e.ph, -1, bulk);
    ctx.restore();

    // 체력 숫자 — 이 장르는 머리 위 숫자가 커지는 게 재미다
    const fs = Math.max(9, 15 * p * 2.6);
    ctx.font = `bold ${fs}px Consolas, monospace`;
    ctx.textAlign = 'center';
    const ty = y - (e.kind === 'boss' ? 150 * p * 3.4 : 40 * s);
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillText(fmt(e.hp), x + 1, ty + 1);
    ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#ffe9e9' : '#ff9d9d';
    ctx.fillText(fmt(e.hp), x, ty);
  }

  function drawDrop(d: Drop) {
    const p = persp(d.z);
    const x = sx(d.x, d.z), y = sy(d.z);
    const size = 62 * p * 2.6;
    const near = Math.abs(d.x - px) < 0.15;
    ctx.save();
    ctx.translate(x, y - size * 0.62);
    // 주울 수 있는 줄에 있으면 밝게
    ctx.fillStyle = d.item.color + (near ? '3a' : '18');
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.66, 0, Math.PI * 2);
    ctx.fill();
    if (!drawSprite(ctx, d.item.sprite, size)) {
      // 이미지 로드 전 — 색 원 위에 흰 테
      ctx.fillStyle = d.item.color;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.36, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // 큼직한 배수 글자
    const fs = Math.max(11, 26 * p * 2.6);
    ctx.textAlign = 'center';
    ctx.font = `bold ${fs}px "Malgun Gothic", sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillText(d.item.tag, x + 1.5, y + 1.5);
    ctx.fillStyle = d.item.color;
    ctx.fillText(d.item.tag, x, y);
    if (p > 0.32) {
      ctx.font = `${Math.max(9, 12 * p * 2.6)}px "Malgun Gothic", sans-serif`;
      ctx.fillStyle = 'rgba(220,230,255,.85)';
      ctx.fillText(d.item.what, x, y + fs * 0.86);
    }
  }

  function drawArrows() {
    // 수십 개가 동시에 날아가므로 눈에 안 띄게 — 반투명·가늘게·먼 것은 더 옅게
    ctx.lineCap = 'round';
    for (const a of arrows) {
      const p = persp(a.z);
      ctx.strokeStyle = `rgba(240,217,166,${0.16 + p * 0.3})`;
      ctx.lineWidth = Math.max(0.8, 2.2 * p * 2.4);
      ctx.beginPath();
      ctx.moveTo(sx(a.x, a.z), sy(a.z));
      ctx.lineTo(sx(a.x, a.z), sy(a.z) + 18 * p * 2.4);
      ctx.stroke();
    }
  }

  function drawHud() {
    const bw = 190, bx = 18, by = 18;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, 14, 7); ctx.fill();
    const frac = Math.max(0, st.hp / st.maxHp);
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#fbbf24' : '#ff5f6e';
    ctx.beginPath(); ctx.roundRect(bx, by, bw * frac, 14, 7); ctx.fill();
    ctx.fillStyle = '#eaf0ff';
    ctx.font = 'bold 11px Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.ceil(st.hp)} / ${st.maxHp}`, bx + 6, by + 11);
    if (st.shield > 0) {
      ctx.fillStyle = '#22c1c3';
      ctx.fillText(`보호막 ${st.shield}`, bx + bw + 10, by + 11);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 26px Consolas, monospace';
    ctx.fillText(fmt(score), W - 18, 38);
    ctx.fillStyle = '#556';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText('BEST ' + fmt(best), W - 18, 56);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffb03a';
    ctx.font = 'bold 15px Consolas, monospace';
    ctx.fillText(`화력 ${fmt(dps(st))}`, bx, by + 36);
    ctx.fillStyle = '#6b7490';
    ctx.font = '11px Consolas, monospace';
    ctx.fillText(`젓가락 ${st.n} · 공격 x${fmt(effMul(st))} · 연사 ${st.rate.toFixed(1)} · 관통 ${st.pierce}`, bx, by + 53);
    if (st.burstT > 0) {
      ctx.fillStyle = st.burst >= 10 ? '#ffd700' : '#ff3d2e';
      ctx.font = 'bold 15px Consolas, monospace';
      ctx.fillText(`공격 ×${st.burst}  ${st.burstT.toFixed(1)}s`, bx + 210, by + 36);
    }
    const ratio = baseDps(st) / baselineDps(wave);
    ctx.fillStyle = ratio >= 1 ? '#4ade80' : '#ff8a8a';
    ctx.fillText(`기준선 대비 ${(ratio * 100).toFixed(0)}%`, bx, by + 69);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#8892a6';
    ctx.font = 'bold 13px "Malgun Gothic", sans-serif';
    ctx.fillText(`구간 ${wave}`, CX, 32);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#333a55';
    ctx.font = '11px Consolas, monospace';
    ctx.fillText('마우스/←→ 좌우 · 발사는 자동 · R 처음으로 · M 소리', 18, H - 12);
    if (showFps) {
      ctx.textAlign = 'right';
      ctx.fillText(quality.fps.toFixed(0) + ' FPS', W - 18, H - 12);
    }
  }

  function drawReady() {
    ctx.fillStyle = 'rgba(6,6,14,.93)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 42px "Malgun Gothic", sans-serif';
    ctx.fillText('K-푸드 사격', CX, 128);
    ctx.fillStyle = '#8892a6';
    ctx.font = '17px "Malgun Gothic", sans-serif';
    ctx.fillText('좌우로만 움직이세요. 발사는 알아서 합니다', CX, 164);

    // 요리사 vs 악당
    ctx.save(); ctx.translate(CX - 130, 310); drawPerson(ctx, 2.6, PAL.chef, 0, -1); ctx.restore();
    ctx.save(); ctx.translate(CX + 120, 310); drawPerson(ctx, 2.6, PAL.grunt, 0, -1); ctx.restore();
    ctx.fillStyle = '#cfd7f5';
    ctx.font = '13px "Malgun Gothic", sans-serif';
    ctx.fillText('나 (요리사)', CX - 130, 330);
    ctx.fillStyle = '#ff9d9d';
    ctx.fillText('악당', CX + 120, 330);

    ctx.fillStyle = '#cfd7f5';
    ctx.font = '15px "Malgun Gothic", sans-serif';
    ctx.fillText('길에 떠내려오는 K-푸드를 몸으로 주우면', CX, 392);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 17px "Malgun Gothic", sans-serif';
    ctx.fillText('불닭 ×3 · 김치 ×10 · 김밥 +3 …', CX, 420);
    ctx.fillStyle = '#cfd7f5';
    ctx.font = '15px "Malgun Gothic", sans-serif';
    ctx.fillText('그만큼 세집니다', CX, 446);

    ctx.fillStyle = '#ff8a8a';
    ctx.font = '14px "Malgun Gothic", sans-serif';
    ctx.fillText('못 죽인 악당이 내 앞까지 오면 체력이 깎입니다', CX, 494);
    ctx.fillStyle = '#5b6480';
    ctx.font = '13px "Malgun Gothic", sans-serif';
    ctx.fillText('체력이 0이 되면 끝 · 5구간마다 보스', CX, 520);

    ctx.fillStyle = '#8892a6';
    ctx.font = '16px "Malgun Gothic", sans-serif';
    ctx.fillText('클릭하거나 스페이스바를 눌러 시작', CX, H - 86);
  }

  function drawOver() {
    ctx.fillStyle = 'rgba(8,8,16,.88)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const g = gradeOf(CONFIG.grades, score);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 27px Consolas, monospace';
    ctx.fillText('SCORE  ' + fmt(score), CX, H / 2 - 130);
    ctx.fillStyle = g.color;
    ctx.shadowColor = g.color;
    ctx.shadowBlur = 30;
    ctx.font = 'bold 126px "Segoe UI", sans-serif';
    ctx.fillText(g.label, CX, H / 2);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 26px "Malgun Gothic", sans-serif';
    ctx.fillText(g.msg, CX, H / 2 + 46);
    ctx.fillStyle = '#cfd7f5';
    ctx.font = '16px "Malgun Gothic", sans-serif';
    ctx.fillText(`${wave}구간 · ${kills}명 처치 · 아이템 ${picked}개`, CX, H / 2 + 90);
    ctx.fillStyle = '#ffb03a';
    ctx.font = 'bold 17px Consolas, monospace';
    ctx.fillText(`최종 화력 ${fmt(dps(st))}`, CX, H / 2 + 120);
    ctx.fillStyle = '#6b7490';
    ctx.font = '13px Consolas, monospace';
    ctx.fillText(`젓가락 ${st.n} · 공격 x${fmt(st.mul)} · 관통 ${st.pierce}`, CX, H / 2 + 144);
    ctx.fillStyle = '#8892a6';
    ctx.font = '15px "Malgun Gothic", sans-serif';
    ctx.fillText(`최고 ${fmt(best)}점`, CX, H / 2 + 176);
    ctx.fillText('클릭하거나 스페이스바로 다시', CX, H - 56);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawRoad();

    if (state === 'play' || state === 'over') {
      // 먼 것부터 그려야 가까운 것이 위로 온다
      const far = [
        ...enemies.map(e => ({ z: e.z, f: () => drawEnemy(e) })),
        ...drops.map(d => ({ z: d.z, f: () => drawDrop(d) })),
      ].sort((a, b) => a.z - b.z);
      for (const o of far) o.f();
      drawArrows();
      drawPlayer();

      for (const q of particles) {
        ctx.globalAlpha = Math.max(0, q.life / q.max);
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const u of popups) {
        ctx.globalAlpha = Math.min(1, u.life * 1.7);
        ctx.fillStyle = u.color;
        ctx.font = `bold ${u.big ? 28 : 17}px "Malgun Gothic", sans-serif`;
        ctx.fillText(u.text, u.x, u.y);
      }
      ctx.globalAlpha = 1;
      drawHud();
    }

    if (hurtT > 0) {
      ctx.fillStyle = `rgba(255,60,80,${hurtT * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (state === 'ready') drawReady();
    if (state === 'over') drawOver();
    ctx.restore();
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
