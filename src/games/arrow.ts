/**
 * K-푸드 사격 — 자동 전진·자동 발사 슈팅 (Arrow a Row 계열)
 *
 * 조작은 **좌우뿐**이다. 전진도 발사도 알아서 한다.
 * 구간마다 화면을 가로지르는 **게이트**가 내려오고, 어느 쪽으로 지나가느냐로 강화를 고른다.
 *
 * ── 이 장르의 핵심은 두 곡선의 줄다리기다
 *     플레이어 화력 ↑   vs   적 체력 ↑
 *   둘 다 지수로 커지되, 적 체력 기준선을 "아무거나 고르는 사람"의 화력에 맞췄다.
 *   그래서 잘 고르면 적이 녹고, 못 고르면 못 죽인 적이 아래로 새어 나와 나를 때린다.
 *   **죽는 조건이 곧 화력 방정식**이다 — 수치는 arrowBalance.ts에 전부 모아 두었다.
 */
import { sound, type Pattern } from '../lib/sound';
import { gradeOf, saveScore, getBest, KEYS, type Grade } from '../lib/score';
import { Quality } from '../lib/perf';
import { drawSprite, type SpriteKey } from '../lib/sprites';
import {
  initialStats, dps, damagePerArrow, shownArrows, rollChoices,
  enemyHp, enemyDamage, enemyScore, baselineDps, GATES, WAVE,
  type Stats, type Gate, type EnemyKind,
} from './arrowBalance';

/* ===== 설정 ===== */
const CONFIG = {
  grades: [
    // 문턱은 전체 게임을 시뮬레이션해서 정했다.
    //   부스 손님 모델(겨냥은 하되 반응이 늦고 게이트를 안 읽음) 720~12,261 · 중앙 2,597 · 14구간 2.1분
    //   요령 있는 사람(가장 아래 적을 겨냥 + 좋은 게이트 선택)  2,688~335,379 · 중앙 13,946 · 24구간 3.4분
    // → 대부분 C·B, 잘하면 A, S는 드물게.
    { min: 20000, label: 'S', color: '#ffd700', msg: '전설의 사수!' },
    { min: 8000, label: 'A', color: '#ff5f9e', msg: '대단해요!' },
    { min: 3000, label: 'B', color: '#00ffc8', msg: '잘했어요!' },
    { min: 1200, label: 'C', color: '#6ea8ff', msg: '좋아요!' },
    { min: 0, label: 'D', color: '#8892a6', msg: '다시 도전!' },
  ] as Grade[],
  moveSpeed: 440,      // 좌우 이동 속도 px/s
  scrollSpeed: 260,    // 길이 흘러내려오는 속도 — 궁수가 앞으로 달리는 느낌
  roadPad: 26,         // 길 양옆 길가 폭 (여기로는 못 간다)
};

/* ===== BGM ===== */
const BGM: Pattern = {
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
  hat: [0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
  bass: [98, 0, 98, 0, 131, 0, 110, 0, 147, 0, 131, 0, 110, 0, 98, 0],
  lead: [587, 0, 0, 659, 0, 784, 0, 0, 659, 0, 587, 0, 0, 494, 0, 0],
};

const SFX = {
  shoot: () => sound.tone({ f: 1500, f2: 900, dur: 0.03, vol: 0.028 }),
  hit: () => sound.noise({ dur: 0.03, vol: 0.07, fc: 3000 }),
  kill: () => { sound.noise({ dur: 0.14, vol: 0.16, fc: 1400 }); sound.tone({ f: 300, f2: 90, dur: 0.14, type: 'sine', vol: 0.14 }); },
  gate: (col: number) => [440, 660].forEach((f, i) => sound.tone({ f: f * (col ? 1.25 : 1), dur: 0.1, vol: 0.18, when: i * 0.07 })),
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

/* ===== 적 ===== */
interface EnemySpec { key: SpriteKey; w: number; speed: number; }
const ENEMY: Record<EnemyKind, EnemySpec> = {
  grunt:  { key: 'mandu',      w: 54,  speed: 44 },
  runner: { key: 'gimbap',     w: 62,  speed: 108 },
  tank:   { key: 'cupteok',    w: 74,  speed: 30 },
  boss:   { key: 'buldak',     w: 168, speed: 17 },
};

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number; y: number;
  w: number; h: number;
  hp: number; maxHp: number;
  dmg: number; score: number;
  flash: number;
  /** 보스가 자리를 잡고 때리기까지 남은 시간 */
  atk: number;
}

interface Arrow {
  x: number; y: number; vy: number;
  dmg: number; pierce: number;
  /** 이 젓가락이 이미 뚫은 적 — 지나가는 동안 같은 적을 여러 번 때리지 않게 (관통 수만큼만 담긴다) */
  hitIds: number[];
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }
interface Popup { x: number; y: number; text: string; color: string; life: number }

/** 화면을 가로지르며 내려오는 강화 게이트 */
interface GateRun { y: number; left: Gate; right: Gate; taken: boolean }

type State = 'ready' | 'play' | 'over';

export function createArrow(cv: HTMLCanvasElement): () => void {
  const W = 400, H = 720;
  const ctx = cv.getContext('2d', { alpha: false })!;
  const fit = Math.min(1, (innerWidth - 40) / W, Math.max(0.5, (innerHeight - 210) / H));
  const quality = new Quality(cv, ctx, W, H, fit);

  const PLAYER_Y = H - 96;
  const LEAK_Y = H - 40;        // 여기까지 내려온 적은 나를 때리고 사라진다
  const KEY = KEYS.arrow;

  /* ===== 상태 ===== */
  let state: State = 'ready';
  let st: Stats = initialStats();
  let score = 0, best = getBest(KEY), wave = 0, kills = 0, waveT = 0, runT = 0;
  let px = W / 2, fireT = 0, hurtT = 0, shake = 0, overT = 0;
  let gate: GateRun | null = null;
  let enemies: Enemy[] = [];
  let arrows: Arrow[] = [];
  const particles: Particle[] = [];
  const popups: Popup[] = [];
  let enemyId = 1;
  /** 한 구간에 게이트는 딱 하나 — 보스 구간이 길어져도 반복해서 열리면 안 된다 */
  let gateUsed = false;
  let bossAlive = false;
  let showFps = false;
  let scroll = 0;
  const held = new Set<string>();
  /** 길가에 흘러가는 소품 — 풀·돌·등불. 흘러가야 앞으로 가는 게 보인다 */
  interface Roadside { x: number; y: number; kind: 0 | 1 | 2; s: number }
  const roadside: Roadside[] = Array.from({ length: 22 }, () => ({
    x: 0, y: Math.random() * H, kind: 0 as 0 | 1 | 2, s: 1,
  }));
  const ROAD_L = CONFIG.roadPad, ROAD_R = W - CONFIG.roadPad;
  function seedRoadside(r: Roadside, y: number) {
    const left = Math.random() < 0.5;
    r.x = left ? Math.random() * (ROAD_L - 6) + 3 : ROAD_R + 3 + Math.random() * (ROAD_L - 6);
    r.y = y;
    const k = Math.random();
    r.kind = k < 0.55 ? 0 : k < 0.85 ? 1 : 2;
    r.s = 0.7 + Math.random() * 0.6;
  }
  for (const r of roadside) seedRoadside(r, r.y);

  /* ===== 스폰 ===== */
  function spawnEnemy(kind: EnemyKind, x: number, y: number) {
    const sp = ENEMY[kind];
    const hp = enemyHp(kind, wave);
    enemies.push({
      id: enemyId++,
      kind, x, y,
      w: sp.w, h: sp.w * 0.62,
      hp, maxHp: hp,
      dmg: enemyDamage(kind, wave),
      score: enemyScore(kind, wave),
      flash: 0,
      atk: 0,
    });
  }

  function startWave() {
    wave++;
    waveT = 0;
    gateUsed = false;
    if (wave % WAVE.bossEvery === 0) {
      spawnEnemy('boss', W / 2, -120);
      bossAlive = true;
      SFX.boss();
      popups.push({ x: W / 2, y: 190, text: '보스 등장!', color: '#ff5f9e', life: 1.6 });
      return;
    }
    // 구간이 오를수록 수가 늘지만, 화력도 같이 커지므로 완만하게
    const n = WAVE.count(wave);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      const kind: EnemyKind = r < 0.2 && wave > 2 ? 'tank' : r < 0.55 ? 'runner' : 'grunt';
      const sp = ENEMY[kind];
      spawnEnemy(kind, ROAD_L + sp.w / 2 + Math.random() * (ROAD_R - ROAD_L - sp.w), -40 - i * (70 + Math.random() * 60) - sp.w);
    }
  }

  function openGate() {
    const [a, b] = rollChoices();
    gate = { y: -70, left: a, right: b, taken: false };
  }

  /* ===== 효과 ===== */
  function burst(x: number, y: number, color: string, n: number, spd: number) {
    if (quality.low) n = Math.max(3, n >> 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random();
      const s = spd * (0.4 + Math.random() * 0.9);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.3, max: 0.65, color, r: 1.8 + Math.random() * 2.2 });
    }
  }

  function hurt(amount: number) {
    if (st.shield > 0) {
      st.shield--;
      popups.push({ x: px, y: PLAYER_Y - 40, text: '보호막!', color: '#22c1c3', life: 0.9 });
      burst(px, PLAYER_Y, '#22c1c3', 14, 200);
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
    score = 0; wave = 0; kills = 0; waveT = 0; runT = 0;
    px = W / 2; fireT = 0; hurtT = 0; shake = 0;
    enemies = []; arrows = []; gate = null; bossAlive = false;
    particles.length = 0; popups.length = 0;
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

  function localX(e: PointerEvent) {
    const r = cv.getBoundingClientRect();
    return (e.clientX - r.left) / (r.width / W);
  }
  cv.addEventListener('pointermove', e => { if (state === 'play') px = localX(e); }, opts);
  cv.addEventListener('pointerdown', e => { if (state === 'play') px = localX(e); press(); }, opts);

  /* ===== 업데이트 ===== */
  function update(dt: number) {
    scroll = (scroll + CONFIG.scrollSpeed * dt) % 48;
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (hurtT > 0) hurtT -= dt;

    for (const r of roadside) { r.y += CONFIG.scrollSpeed * dt; if (r.y > H + 20) seedRoadside(r, -20 - Math.random() * 60); }

    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      if (q.life <= 0) { particles.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt;
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt; popups[i].y -= 30 * dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }

    if (state !== 'play') return;
    runT += dt;
    waveT += dt;

    /* 좌우 이동 */
    if (held.has('ArrowLeft')) px -= CONFIG.moveSpeed * dt;
    if (held.has('ArrowRight')) px += CONFIG.moveSpeed * dt;
    px = Math.max(ROAD_L + 22, Math.min(ROAD_R - 22, px));

    /* 자동 발사 — 한 번에 '한 줄'로 나간다 (이 장르의 이름이 그렇다) */
    fireT -= dt;
    if (fireT <= 0) {
      fireT = 1 / st.rate;
      const n = shownArrows(st);
      const dmg = damagePerArrow(st);
      const span = Math.min(ROAD_R - ROAD_L - 30, 12 + n * 8);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0.5 : i / (n - 1);
        arrows.push({
          x: px - span / 2 + span * t,
          y: PLAYER_Y - 20,
          vy: -900,
          dmg, pierce: st.pierce, hitIds: [],
        });
      }
      SFX.shoot();
    }

    /* 젓가락 이동 */
    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      a.y += a.vy * dt;
      if (a.y < -20) arrows.splice(i, 1);
    }

    /* 적 이동 + 아래로 샘 */
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.y += ENEMY[e.kind].speed * WAVE.speedMul(wave) * dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.kind === 'boss') {
        // 보스는 새지 않고 자리를 잡은 뒤 주기적으로 때린다
        if (e.y > LEAK_Y - 150) {
          e.y = LEAK_Y - 150;
          e.atk -= dt;
          if (e.atk <= 0) { e.atk = 2.2; hurt(e.dmg); burst(e.x, e.y + 40, '#ff5f9e', 16, 240); }
        }
      } else if (e.y > LEAK_Y) {
        // 못 죽인 적이 나를 때린다 — 화력이 기준선에 못 미치면 여기서 죽는다
        enemies.splice(i, 1);
        hurt(e.dmg);
        burst(e.x, LEAK_Y, '#ff5f9e', 14, 220);
      }
    }

    /* 명중 판정 — 젓가락 하나가 관통 수만큼 뚫는다 */
    for (let ai = arrows.length - 1; ai >= 0; ai--) {
      const a = arrows[ai];
      for (const e of enemies) {
        if (a.hitIds.includes(e.id)) continue;
        if (Math.abs(a.x - e.x) > e.w / 2 || Math.abs(a.y - e.y) > e.h / 2) continue;
        a.hitIds.push(e.id);
        e.hp -= a.dmg;
        e.flash = 0.08;
        burst(a.x, a.y, '#ffe6a8', 2, 90);
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
      popups.push({ x: e.x, y: e.y, text: `+${e.score}`, color: '#ffd700', life: 0.8 });
      if (e.kind === 'boss') {
        bossAlive = false;
        shake = 16;
        burst(e.x, e.y, '#ff6a2a', 46, 400);
        SFX.bossDown();
      } else {
        burst(e.x, e.y, '#ffb03a', 12, 190);
        SFX.kill();
      }
    }
    if (enemies.length === 0) bossAlive = false;

    /* 게이트 — 구간의 60% 지점에 열리고, 플레이어 줄을 지나갈 때 적용된다 */
    if (!gate && !gateUsed && waveT > WAVE.time * 0.6) { openGate(); gateUsed = true; }
    if (gate) {
      gate.y += 150 * dt;
      if (!gate.taken && gate.y >= PLAYER_Y - 10) {
        gate.taken = true;
        const pick = px < W / 2 ? gate.left : gate.right;
        pick.apply(st);
        SFX.gate(px < W / 2 ? 0 : 1);
        popups.push({ x: px, y: PLAYER_Y - 60, text: pick.label, color: pick.color, life: 1.5 });
        burst(px, PLAYER_Y - 20, pick.color, 20, 260);
      }
      if (gate.y > H + 80) gate = null;
    }

    /* 다음 구간 — 보스는 잡아야 넘어간다 */
    if (waveT > WAVE.time && !bossAlive) startWave();
  }

  /* ===== 그리기 ===== */
  /** 아래로 흘러내려오는 돌길 — 궁수는 제자리, 길이 지나가야 앞으로 가는 것처럼 보인다 */
  function drawRoad() {
    // 길가(풀밭)
    ctx.fillStyle = '#17231a';
    ctx.fillRect(0, 0, W, H);
    // 길 본체
    const TILE = 48;
    ctx.fillStyle = '#3a3128';
    ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
    // 돌 타일 — 줄마다 반 칸씩 어긋나게, 아래로 흐른다
    const cols = Math.ceil((ROAD_R - ROAD_L) / TILE) + 1;
    let row = Math.floor(-scroll / TILE) - 2;
    for (let y = scroll - TILE * 2; y < H; y += TILE, row++) {
      const off = (row & 1) ? TILE / 2 : 0;
      for (let c = -1; c < cols; c++) {
        const x = ROAD_L + c * TILE + off;
        const x0 = Math.max(ROAD_L, x + 2), x1 = Math.min(ROAD_R, x + TILE - 2);
        if (x1 <= x0) continue;
        const shade = (((c * 7 + row * 13) % 5) + 5) % 5 * 0.035;
        ctx.fillStyle = `rgba(255,230,200,${0.05 + shade})`;
        ctx.fillRect(x0, y + 2, x1 - x0, TILE - 4);
      }
    }
    // 길 가장자리 경계석
    ctx.fillStyle = '#5a4d3e';
    ctx.fillRect(ROAD_L - 4, 0, 4, H);
    ctx.fillRect(ROAD_R, 0, 4, H);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    for (let y = scroll - TILE; y < H; y += TILE / 2) {
      ctx.fillRect(ROAD_L - 4, y, 4, 2);
      ctx.fillRect(ROAD_R, y, 4, 2);
    }
    // 길가 소품
    for (const r of roadside) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(r.s, r.s);
      if (r.kind === 0) {
        // 풀
        ctx.strokeStyle = '#2f5a34';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-4, 4); ctx.lineTo(-3, -5);
        ctx.moveTo(0, 4); ctx.lineTo(1, -7);
        ctx.moveTo(4, 4); ctx.lineTo(4, -4);
        ctx.stroke();
      } else if (r.kind === 1) {
        // 돌
        ctx.fillStyle = '#4c4a45';
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        ctx.beginPath(); ctx.ellipse(-1.5, -1.5, 3, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        // 등불 — 길이 어디로 이어지는지 알려 주는 표지
        ctx.fillStyle = '#3b2a1c';
        ctx.fillRect(-1.5, -14, 3, 18);
        const gl = ctx.createRadialGradient(0, -16, 1, 0, -16, 16);
        gl.addColorStop(0, 'rgba(255,190,90,.55)');
        gl.addColorStop(1, 'rgba(255,190,90,0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.arc(0, -16, 16, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffc861';
        ctx.beginPath(); ctx.roundRect(-4, -20, 8, 8, 2); ctx.fill();
      }
      ctx.restore();
    }
    // 앞쪽(위)은 안개로 흐리게 — 길이 저 멀리까지 이어지는 느낌
    const fog = ctx.createLinearGradient(0, 0, 0, 170);
    fog.addColorStop(0, 'rgba(8,10,14,.92)');
    fog.addColorStop(1, 'rgba(8,10,14,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W, 170);
  }

  function drawPlayer() {
    ctx.save();
    ctx.translate(px, PLAYER_Y);
    if (hurtT > 0 && Math.floor(hurtT * 20) % 2) ctx.globalAlpha = 0.45;

    // 보호막
    if (st.shield > 0) {
      ctx.strokeStyle = `rgba(34,193,195,${0.5 + Math.sin(runT * 6) * 0.2})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -4, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 밥그릇 궁수 — 활을 앞으로 겨누고 길을 따라 달린다. 살짝 위아래로 흔들려야 뛰는 것처럼 보인다
    ctx.translate(0, Math.sin(runT * 14) * 1.6);
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 24, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 활 — 앞(위)을 향해 당겨진 호
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -14, 30, Math.PI * 1.12, Math.PI * 1.88);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-28, -23); ctx.lineTo(0, -6); ctx.lineTo(28, -23);
    ctx.stroke();
    const g = ctx.createLinearGradient(0, -14, 0, 16);
    g.addColorStop(0, '#eef4ff');
    g.addColorStop(0.5, '#9fb4dd');
    g.addColorStop(1, '#4a5578');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-24, -8);
    ctx.quadraticCurveTo(-20, 16, 0, 16);
    ctx.quadraticCurveTo(20, 16, 24, -8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fffdf4';
    ctx.beginPath();
    ctx.ellipse(0, -9, 23, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // 장전된 젓가락
    ctx.strokeStyle = '#d8bb84';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -12); ctx.lineTo(-7, -30);
    ctx.moveTo(5, -12); ctx.lineTo(7, -30);
    ctx.stroke();
    ctx.restore();
  }

  function drawArrows() {
    ctx.strokeStyle = '#f0d9a6';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const a of arrows) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(a.x, a.y + 15);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,240,200,.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const a of arrows) {
      ctx.moveTo(a.x, a.y - 3);
      ctx.lineTo(a.x, a.y + 2);
    }
    ctx.stroke();
  }

  function drawEnemy(e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);
    // 적 표시 — 붉은 열기 (아이템이 아니라 적이라는 신호)
    const R = e.w * 0.62;
    const gr = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R);
    gr.addColorStop(0, 'rgba(255,70,60,.30)');
    gr.addColorStop(1, 'rgba(255,70,60,0)');
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();

    if (e.flash > 0) { ctx.globalAlpha = 0.55; }
    if (!drawSprite(ctx, ENEMY[e.kind].key, e.w)) {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.ellipse(0, 0, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 체력바 — 강화할수록 이 막대가 길어지는 게 이 게임의 재미다
    const bw = Math.max(34, e.w * 0.9), bh = e.kind === 'boss' ? 7 : 4.5;
    const by = -e.h / 2 - (e.kind === 'boss' ? 18 : 11);
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath(); ctx.roundRect(-bw / 2, by, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = frac > 0.5 ? '#4ade80' : frac > 0.22 ? '#fbbf24' : '#ff5f6e';
    ctx.beginPath(); ctx.roundRect(-bw / 2, by, bw * frac, bh, bh / 2); ctx.fill();
    if (e.kind === 'boss') {
      ctx.fillStyle = '#ffd7d7';
      ctx.font = 'bold 11px Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(e.hp).toLocaleString(), 0, by - 4);
    }
    ctx.restore();
  }

  function drawGate() {
    if (!gate) return;
    const h = 62;
    const halves: [Gate, number, number][] = [[gate.left, 0, W / 2], [gate.right, W / 2, W / 2]];
    for (const [g, x, w] of halves) {
      const on = !gate.taken && (px < W / 2) === (x === 0);
      ctx.fillStyle = g.color + (on ? '44' : '22');
      ctx.fillRect(x, gate.y, w, h);
      ctx.strokeStyle = g.color + (on ? 'ff' : '99');
      ctx.lineWidth = on ? 3 : 1.6;
      ctx.strokeRect(x + 1.5, gate.y + 1.5, w - 3, h - 3);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 17px "Malgun Gothic", sans-serif';
      ctx.fillText(g.label, x + w / 2, gate.y + 26);
      ctx.fillStyle = g.color;
      ctx.font = '12px "Malgun Gothic", sans-serif';
      ctx.fillText(g.desc, x + w / 2, gate.y + 45);
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 2, gate.y);
    ctx.lineTo(W / 2, gate.y + h);
    ctx.stroke();
  }

  function drawHud() {
    // 체력
    const bw = 150, bx = 14, by = 18;
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
      ctx.fillText(`보호막 ${st.shield}`, bx + bw + 8, by + 11);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 24px Consolas, monospace';
    ctx.fillText(String(score).padStart(6, '0'), W - 14, 36);
    ctx.fillStyle = '#8a8fa8';
    ctx.font = '11px Consolas, monospace';
    ctx.fillText('BEST ' + String(best).padStart(6, '0'), W - 14, 52);

    // 화력 — 이 숫자가 커지는 걸 보는 게 이 장르의 맛이다
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffb03a';
    ctx.font = 'bold 15px Consolas, monospace';
    ctx.fillText(`화력 ${Math.round(dps(st)).toLocaleString()}`, bx, by + 38);
    ctx.fillStyle = '#9aa3bf';
    ctx.font = '11px Consolas, monospace';
    ctx.fillText(
      `젓가락 ${st.n} · 공격 x${st.mul.toFixed(1)} · 연사 ${st.rate.toFixed(1)} · 관통 ${st.pierce}`,
      bx, by + 55,
    );
    // 기준선 대비 — 앞서는지 뒤처지는지 한눈에
    const ratio = dps(st) / baselineDps(wave);
    ctx.fillStyle = ratio >= 1 ? '#4ade80' : '#ff8a8a';
    ctx.fillText(`기준선 대비 ${(ratio * 100).toFixed(0)}%`, bx, by + 71);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#c7cde0';
    ctx.font = 'bold 13px "Malgun Gothic", sans-serif';
    ctx.fillText(`구간 ${wave}`, W - 14, 72);

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,240,220,.35)';
    ctx.font = '10px Consolas, monospace';
    ctx.fillText('마우스/←→ 이동 · 발사 자동 · R 처음 · M 소리', 14, H - 10);
    if (showFps) {
      ctx.textAlign = 'right';
      ctx.fillText(quality.fps.toFixed(0) + ' FPS', W - 14, H - 10);
    }
  }

  function drawReady() {
    ctx.fillStyle = 'rgba(5,5,12,.92)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 40px "Malgun Gothic", sans-serif';
    ctx.fillText('K-푸드 사격', W / 2, 140);
    ctx.fillStyle = '#8892a6';
    ctx.font = '15px "Malgun Gothic", sans-serif';
    ctx.fillText('좌우로만 움직이세요. 발사는 알아서 합니다', W / 2, 178);

    ctx.fillStyle = '#cfd7f5';
    ctx.font = '15px "Malgun Gothic", sans-serif';
    ctx.fillText('내려오는 강화 게이트를', W / 2, 236);
    ctx.fillText('어느 쪽으로 지나갈지 고르세요', W / 2, 260);

    // 게이트 예시
    const gy = 292, gh = 58;
    const demo: [Gate, number][] = [[GATES[0], 0], [GATES[2], W / 2]];
    for (const [g, x] of demo) {
      ctx.fillStyle = g.color + '22';
      ctx.fillRect(x + 16, gy, W / 2 - 32, gh);
      ctx.strokeStyle = g.color + 'aa';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 17.5, gy + 1.5, W / 2 - 35, gh - 3);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px "Malgun Gothic", sans-serif';
      ctx.fillText(g.label, x + W / 4, gy + 25);
      ctx.fillStyle = g.color;
      ctx.font = '12px "Malgun Gothic", sans-serif';
      ctx.fillText(g.desc, x + W / 4, gy + 44);
    }

    ctx.fillStyle = '#8892a6';
    ctx.font = '13px "Malgun Gothic", sans-serif';
    ctx.fillText('고를수록 젓가락이 불어나고, 적의 체력도 같이 커집니다', W / 2, 396);
    ctx.fillStyle = '#ff8a8a';
    ctx.fillText('못 죽인 적이 아래로 내려오면 체력이 깎입니다', W / 2, 422);
    ctx.fillStyle = '#5b6480';
    ctx.font = '13px "Malgun Gothic", sans-serif';
    ctx.fillText('체력이 0이 되면 끝 · 5구간마다 보스', W / 2, 450);

    ctx.fillStyle = '#8892a6';
    ctx.font = '16px "Malgun Gothic", sans-serif';
    ctx.fillText('클릭하거나 스페이스바를 눌러 시작', W / 2, H - 90);
  }

  function drawOver() {
    ctx.fillStyle = 'rgba(10,10,18,.87)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const g = gradeOf(CONFIG.grades, score);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 28px Consolas, monospace';
    ctx.fillText('SCORE  ' + score.toLocaleString(), W / 2, H / 2 - 130);
    ctx.fillStyle = g.color;
    ctx.shadowColor = g.color;
    ctx.shadowBlur = 30;
    ctx.font = 'bold 116px "Segoe UI", sans-serif';
    ctx.fillText(g.label, W / 2, H / 2);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 26px "Malgun Gothic", sans-serif';
    ctx.fillText(g.msg, W / 2, H / 2 + 46);
    ctx.fillStyle = '#cfd7f5';
    ctx.font = '16px "Malgun Gothic", sans-serif';
    ctx.fillText(`${wave}구간 도달 · ${kills}마리 처치`, W / 2, H / 2 + 90);
    ctx.fillStyle = '#ffb03a';
    ctx.font = 'bold 17px Consolas, monospace';
    ctx.fillText(`최종 화력 ${Math.round(dps(st)).toLocaleString()}`, W / 2, H / 2 + 120);
    ctx.fillStyle = '#6b7490';
    ctx.font = '13px Consolas, monospace';
    ctx.fillText(`젓가락 ${st.n} · 공격 x${st.mul.toFixed(1)} · 관통 ${st.pierce}`, W / 2, H / 2 + 144);
    ctx.fillStyle = '#8892a6';
    ctx.font = '15px "Malgun Gothic", sans-serif';
    ctx.fillText(`최고 ${best.toLocaleString()}점`, W / 2, H / 2 + 176);
    ctx.fillText('클릭하거나 스페이스바로 다시', W / 2, H - 60);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    drawRoad();

    if (state === 'play' || state === 'over') {
      drawGate();
      drawArrows();
      for (const e of enemies) drawEnemy(e);
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
        ctx.font = 'bold 17px Consolas, monospace';
        ctx.fillText(u.text, u.x, u.y);
      }
      ctx.globalAlpha = 1;

      // 적이 새는 경계
      ctx.strokeStyle = 'rgba(255,95,110,.18)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(ROAD_L, LEAK_Y); ctx.lineTo(ROAD_R, LEAK_Y); ctx.stroke();
      ctx.setLineDash([]);

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
