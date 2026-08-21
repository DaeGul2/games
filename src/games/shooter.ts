/**
 * 벡터 스트라이크 — 15웨이브 + 최종보스 클리어형 슈팅 엔진
 * 조작: 마우스/방향키 이동, 공격 자동, M(음소거)
 *
 * 수학 패턴 요약:
 *  - sine:    x(t) = x0 + A·sin(ωt + φ)          — 사인파 횡이동
 *  - spiral:  (x,y) = 중심 + r(t)·(cosθ, sinθ)    — 극좌표 나선 진입 (r 지수 수렴)
 *  - diver:   v = spd·(P − E)/|P − E|            — 조준 벡터 돌진
 *  - ring:    vᵢ = spd·(cos(2πi/n), sin(2πi/n))  — 등각 방사 탄막
 *  - homing:  각속도 제한 유도 조향
 *  - final:   리사주 곡선 이동 x=A·sin(at), y=B·sin(bt+δ)
 */
import { sound, type Pattern } from '../lib/sound';
import { gradeOf, saveScore, getBest, KEYS, type Grade } from '../lib/score';

/* ===== 설정 (부스 운영 중 조정 가능) ===== */
const CONFIG = {
  grades: [
    { min: 30000, label: 'S', color: '#ffd700', msg: '에이스 파일럿!' },
    { min: 20000, label: 'A', color: '#ff5f9e', msg: '대단해요!' },
    { min: 12000, label: 'B', color: '#00ffc8', msg: '잘했어요!' },
    { min: 5000, label: 'C', color: '#6ea8ff', msg: '좋아요!' },
    { min: 0, label: 'D', color: '#8892a6', msg: '다시 도전!' },
  ] as Grade[],
  lives: 3,
  finalWave: 15,
  playerSpeed: 520,
  clearBonus: 5000,
  lifeBonus: 2000,
};

/* ===== BGM ===== */
const BGM_MAIN: Pattern = {
  kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
  hat: [0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 1],
  bass: [82, 0, 82, 82, 0, 82, 0, 98, 110, 0, 110, 110, 0, 98, 0, 82],
  lead: [330, 0, 392, 0, 494, 0, 587, 0, 494, 0, 392, 0, 330, 0, 0, 0, 330, 0, 392, 0, 494, 0, 587, 0, 659, 0, 587, 0, 494, 0, 0, 0],
};
const BGM_BOSS: Pattern = {
  kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  hat: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1],
  bass: [82, 0, 82, 0, 87, 0, 87, 0, 82, 0, 82, 0, 93, 0, 87, 0],
  lead: [330, 0, 0, 0, 466, 0, 0, 0, 330, 0, 0, 330, 466, 0, 494, 0],
};

const SFX = {
  shoot: () => sound.tone({ f: 1200, f2: 600, dur: 0.05, vol: 0.05 }),
  hit: () => sound.noise({ dur: 0.04, vol: 0.1, fc: 2600 }),
  boom: () => { sound.noise({ dur: 0.25, vol: 0.28, fc: 1100 }); sound.tone({ f: 220, f2: 55, dur: 0.25, type: 'sine', vol: 0.25 }); },
  bigBoom: () => { sound.noise({ dur: 0.9, vol: 0.5, fc: 750 }); sound.tone({ f: 150, f2: 32, dur: 0.9, type: 'sawtooth', vol: 0.3 }); },
  hurt: () => { sound.tone({ f: 220, f2: 80, dur: 0.3, type: 'sawtooth', vol: 0.32 }); sound.noise({ dur: 0.2, vol: 0.25, fc: 800 }); },
  power: () => [523, 659, 784].forEach((f, i) => sound.tone({ f, dur: 0.09, vol: 0.18, when: i * 0.07 })),
  maxpower: () => [659, 784, 1047, 1319].forEach((f, i) => sound.tone({ f, dur: 0.09, vol: 0.18, when: i * 0.07 })),
  wave: () => { sound.tone({ f: 440, dur: 0.1, vol: 0.13 }); sound.tone({ f: 660, dur: 0.14, vol: 0.13, when: 0.1 }); },
  alarm: () => { for (let i = 0; i < 4; i++) sound.tone({ f: i % 2 ? 554 : 415, dur: 0.2, vol: 0.2, when: i * 0.24 }); },
  missile: () => sound.tone({ f: 950, f2: 250, dur: 0.3, type: 'sawtooth', vol: 0.07 }),
};

function gradeJingle(label: string) {
  const seq: Record<string, number[]> = {
    S: [523, 659, 784, 1047, 1319], A: [523, 659, 784, 1047], B: [523, 659, 784], C: [440, 554], D: [330, 262],
  };
  (seq[label] ?? seq.D).forEach((f, i) => sound.tone({ f, dur: 0.16, vol: 0.18, when: 0.5 + i * 0.13 }));
}
function fanfare() {
  [523, 523, 523, 659, 784, 784, 1047].forEach((f, i) => sound.tone({ f, dur: 0.14, vol: 0.2, when: 0.4 + i * 0.15 }));
}

/* ===== 엔티티 ===== */
type EnemyType = 'sine' | 'spiral' | 'diver' | 'launcher' | 'boss' | 'final';
interface Enemy {
  type: EnemyType; hp: number; r: number; x: number; y: number; t: number;
  maxHp?: number; dead?: boolean;
  x0?: number; amp?: number; omega?: number; vy?: number; shootCd?: number;
  cx?: number; cy?: number; rad?: number; theta?: number; targetRad?: number;
  vx?: number; armed?: boolean; spd?: number;
  ty?: number; ringCd?: number; ringN?: number; spin?: number; aimCd?: number;
  entered?: boolean; streamCd?: number; streamAng?: number; homCd?: number;
}
interface Bullet { x: number; y: number; vx: number; vy: number; dead?: boolean }
interface EBullet extends Bullet { r: number; homing?: boolean; ang?: number; spd?: number; life?: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface Powerup { x0: number; x: number; y: number; t: number; dead?: boolean }
interface FloatText { x: number; y: number; text: string; color: string; life: number }

// 웨이브 구성표 — 갈수록 물량·조합 증가, 중간보스(보라색) 자주 등장
type WaveEntry = [kind: 'sine' | 'spiral' | 'launcher' | 'diver' | 'mid', n: number];
const WAVE_PLAN: Record<number, WaveEntry[]> = {
  1: [['sine', 6]],
  2: [['sine', 7], ['diver', 3]],
  3: [['spiral', 7], ['diver', 3]],
  4: [['launcher', 2], ['sine', 6]],
  5: [['mid', 1], ['sine', 5]],
  6: [['sine', 10], ['diver', 5]],
  7: [['mid', 1], ['spiral', 8], ['diver', 3]],
  8: [['diver', 9], ['sine', 7]],
  9: [['mid', 1], ['launcher', 2], ['spiral', 6]],
  10: [['mid', 2], ['diver', 4]],
  11: [['mid', 1], ['sine', 10], ['diver', 5]],
  12: [['mid', 1], ['spiral', 9], ['launcher', 2], ['diver', 4]],
  13: [['mid', 2], ['sine', 8], ['diver', 5]],
  14: [['mid', 2], ['sine', 9], ['spiral', 8], ['launcher', 2], ['diver', 4]],
};

export function createShooter(cv: HTMLCanvasElement): () => void {
  const W = 720, H = 860;
  const ctx = cv.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = W * dpr;
  cv.height = H * dpr;
  const fit = Math.min(1, (innerHeight - 20) / H, (innerWidth - 20) / W);
  cv.style.width = W * fit + 'px';
  cv.style.height = H * fit + 'px';
  ctx.scale(dpr, dpr);

  const KEY = KEYS.shooter;

  /* ===== 상태 ===== */
  let state: 'ready' | 'play' | 'over' | 'clear' = 'ready';
  let score = 0, combo = 1, comboTimer = 0, lives = 0, time = 0, wave = 0, waveTimer = 0;
  let overTime = 0, shake = 0, waveMsgT = 0, trickleCd = 0;
  const player = { x: W / 2, y: H - 90, r: 11, fireT: 0, inv: 0, weapon: 1 };
  let bullets: Bullet[] = [];
  let ebullets: EBullet[] = [];
  let enemies: Enemy[] = [];
  let powerups: Powerup[] = [];
  let particles: Particle[] = [];
  let floats: FloatText[] = [];
  let best = getBest(KEY);
  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: Math.random() * 1.6 + 0.4, spd: Math.random() * 60 + 20,
  }));

  /* ===== 입력 ===== */
  const keys: Record<string, boolean> = {};
  let mouseX = W / 2, mouseY = H - 90, useMouse = false;

  function pressStart() {
    sound.ensure();
    if (state === 'ready') reset();
    else if ((state === 'over' || state === 'clear') && performance.now() - overTime > 800) reset();
  }

  const ab = new AbortController();
  const opts = { signal: ab.signal };
  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    keys[e.code] = true; useMouse = false;
    if (e.code === 'Space') pressStart();
    if (e.code === 'KeyM' && !e.repeat) sound.toggleMute();
  }, opts);
  window.addEventListener('keyup', e => { keys[e.code] = false; }, opts);
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    mouseX = (e.clientX - r.left) / fit;
    mouseY = (e.clientY - r.top) / fit;
    useMouse = true;
  }, opts);
  cv.addEventListener('pointerdown', pressStart, opts);

  function reset() {
    score = 0; combo = 1; comboTimer = 0; lives = CONFIG.lives;
    time = 0; wave = 0; waveTimer = 1.5; trickleCd = 4;
    player.x = W / 2; player.y = H - 90; player.inv = 2; player.weapon = 1;
    bullets = []; ebullets = []; enemies = []; powerups = []; particles = []; floats = [];
    sound.startMusic(BGM_MAIN, () => 122);
    state = 'play';
  }

  /* ===== 적 생성 ===== */
  const enemyHp = (base: number) => Math.ceil(base * (1 + wave * 0.17));

  function addSine(n: number) {
    for (let i = 0; i < n; i++) {
      enemies.push({
        type: 'sine', hp: enemyHp(1), r: 18,
        x0: 70 + (W - 140) * (i / Math.max(1, n - 1)),
        y: -40 - (i % 5) * 60 - Math.floor(i / 5) * 220,
        x: 0, t: i * 0.6,
        amp: 70 + wave * 4, omega: 2.2,
        vy: 60 + wave * 6,
        shootCd: 1 + Math.random() * 1.6,
      });
    }
  }
  function addSpiral(n: number) {
    for (let i = 0; i < n; i++) {
      enemies.push({
        type: 'spiral', hp: enemyHp(1.3), r: 17,
        cx: W / 2, cy: 250,
        rad: 500, theta: (Math.PI * 2 * i) / n,
        targetRad: 90 + (i % 3) * 65,
        x: W / 2, y: -100, t: 0,
        shootCd: 1.2 + Math.random() * 1.6,
      });
    }
  }
  function addLauncher(n: number) {
    for (let i = 0; i < n; i++) {
      enemies.push({
        type: 'launcher', hp: enemyHp(3), r: 22,
        x: 120 + (W - 240) * (n === 1 ? 0.5 : i / (n - 1)), y: -60, ty: 110 + (i % 2) * 70,
        t: 0, shootCd: 1.8,
      });
    }
  }
  function addDiver(n: number) {
    for (let i = 0; i < n; i++) {
      enemies.push({
        type: 'diver', hp: 1, r: 13,
        x: 50 + Math.random() * (W - 100), y: -30 - Math.random() * 260,
        vx: 0, vy: 0, armed: false, spd: 300 + wave * 14, t: 0,
      });
    }
  }
  function addMidBoss(n: number) {
    for (let i = 0; i < n; i++) {
      const hp = 16 + wave * 3;
      const cx = W * (n === 1 ? 0.5 : 0.3 + 0.4 * i);
      enemies.push({
        type: 'boss', hp, maxHp: hp, r: 40,
        cx, x: cx, y: -80, ty: 150, t: i * 1.5,
        ringCd: 1.6, ringN: Math.min(12 + wave, 26), spin: 0, aimCd: 1.1,
      });
    }
  }
  function addFinalBoss() {
    const hp = 150;
    enemies.push({
      type: 'final', hp, maxHp: hp, r: 52,
      x: W / 2, y: -120, t: 0, entered: false,
      ringCd: 1.6, streamCd: 0.07, streamAng: 0, aimCd: 1.2, homCd: 2.5, spin: 0,
    });
  }

  function spawnWave() {
    wave++; waveMsgT = 1.6;
    if (wave >= CONFIG.finalWave) {
      addFinalBoss();
      SFX.alarm();
      sound.startMusic(BGM_BOSS, () => 150); // 보스전 BGM으로 전환
      return;
    }
    SFX.wave();
    const plan = WAVE_PLAN[wave] ?? WAVE_PLAN[14];
    for (const [kind, n] of plan) {
      if (kind === 'sine') addSine(n);
      else if (kind === 'spiral') addSpiral(n);
      else if (kind === 'launcher') addLauncher(n);
      else if (kind === 'diver') addDiver(n);
      else addMidBoss(n);
    }
  }

  /* ===== 무기 / 아이템 ===== */
  const fireInterval = () => (player.weapon >= 5 ? 0.09 : 0.13);
  function fire() {
    const spd = 950, lv = player.weapon;
    const shots: [number, number][] =
      lv === 1 ? [[0, 0]] :
      lv === 2 ? [[0, -9], [0, 9]] :
      lv === 3 ? [[-0.13, 0], [0, 0], [0.13, 0]] :
                 [[-0.26, 0], [-0.13, 0], [0, 0], [0.13, 0], [0.26, 0]]; // lv 4~5
    for (const [a, off] of shots)
      bullets.push({ x: player.x + off, y: player.y - 16, vx: Math.sin(a) * spd, vy: -Math.cos(a) * spd });
    SFX.shoot();
  }

  function dropLoot(e: Enemy) {
    if (e.type === 'boss') { powerups.push({ x0: e.x, x: e.x, y: e.y, t: 0 }); return; } // 중간보스: 확정 드롭
    if (e.type === 'final') return;
    if (Math.random() < 0.12) powerups.push({ x0: e.x, x: e.x, y: e.y, t: 0 });
  }

  function addFloat(x: number, y: number, text: string, color: string) {
    floats.push({ x, y, text, color, life: 1 });
  }

  function boom(x: number, y: number, color: string, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 220 + 60;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.3, color });
    }
  }

  function hitPlayer() {
    if (player.inv > 0) return;
    lives--; player.inv = 2; shake = 0.4; combo = 1;
    if (player.weapon > 1) { player.weapon--; addFloat(player.x, player.y - 40, 'PW -1', '#ff5f5f'); } // 피격 시 무기 1단계 하락
    boom(player.x, player.y, '#00ffc8', 26);
    SFX.hurt();
    if (lives <= 0) {
      state = 'over'; overTime = performance.now();
      best = saveScore(KEY, Math.floor(score), CONFIG.grades);
      sound.stopMusic();
      gradeJingle(gradeOf(CONFIG.grades, Math.floor(score)).label);
    }
  }

  function killEnemy(e: Enemy) {
    e.dead = true;
    const base = e.type === 'final' ? 3000 : e.type === 'boss' ? 500 : e.type === 'launcher' ? 150 : e.type === 'diver' ? 40 : 60;
    score += base * combo;
    combo = Math.min(combo + 1, 8); comboTimer = 3;
    dropLoot(e);
    boom(e.x, e.y, e.type === 'final' || e.type === 'boss' ? '#ffd700' : '#ff5f9e', e.type === 'final' ? 70 : e.type === 'boss' ? 40 : 12);
    if (e.type === 'boss' || e.type === 'final') { shake = 0.5; SFX.bigBoom(); }
    else SFX.boom();
    if (e.type === 'final') {
      score += CONFIG.clearBonus + lives * CONFIG.lifeBonus;
      state = 'clear'; overTime = performance.now();
      best = saveScore(KEY, Math.floor(score), CONFIG.grades);
      sound.stopMusic();
      fanfare();
    }
  }

  /* ===== 적 사격 헬퍼 ===== */
  function eShoot(e: Enemy, spd: number, r = 6) { // 조준탄: d = (P-E)/|P-E|
    const dx = player.x - e.x, dy = player.y - e.y;
    const m = Math.hypot(dx, dy) || 1;
    ebullets.push({ x: e.x, y: e.y, vx: (dx / m) * spd, vy: (dy / m) * spd, r });
  }
  function eSpread(e: Enemy, spd: number, n: number, arc: number) { // 부채꼴 n발
    const base = Math.atan2(player.y - e.y, player.x - e.x);
    for (let i = 0; i < n; i++) {
      const a = base + arc * (i / (n - 1) - 0.5);
      ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 6 });
    }
  }
  function eRing(e: Enemy, spd: number, n: number, off: number) { // 등각 링
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + off;
      ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 6 });
    }
  }
  function eHoming(e: Enemy) {
    ebullets.push({ x: e.x, y: e.y + 20, r: 8, homing: true, ang: Math.PI / 2, spd: 210 + wave * 6, life: 5, vx: 0, vy: 0 });
    SFX.missile();
  }

  /* ===== 업데이트 ===== */
  function update(dt: number) {
    stars.forEach(s => { s.y += s.spd * dt; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } });
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.vx *= 0.96; p.vy *= 0.96; });
    particles = particles.filter(p => p.life > 0);
    if (shake > 0) shake -= dt;
    if (waveMsgT > 0) waveMsgT -= dt;
    if (state !== 'play') return;

    time += dt;
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 1; }
    if (player.inv > 0) player.inv -= dt;

    // 플레이어 이동: 마우스(프레임레이트 독립 지수 보간) 또는 키보드
    if (useMouse) {
      const f = 1 - Math.exp(-14 * dt);
      player.x += (mouseX - player.x) * f;
      player.y += (mouseY - player.y) * f;
    } else {
      let dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
      let dy = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
      if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
      player.x += dx * CONFIG.playerSpeed * dt;
      player.y += dy * CONFIG.playerSpeed * dt;
    }
    player.x = Math.max(20, Math.min(W - 20, player.x));
    player.y = Math.max(60, Math.min(H - 24, player.y));

    player.fireT -= dt;
    if (player.fireT <= 0) { fire(); player.fireT = fireInterval(); }

    // 웨이브 진행 + 3웨이브부터 다이버 지속 난입
    waveTimer -= dt;
    if (enemies.length === 0 && waveTimer <= 0) { spawnWave(); waveTimer = 1.2; }
    if (wave >= 3 && wave < CONFIG.finalWave) {
      trickleCd -= dt;
      if (trickleCd <= 0) { addDiver(1 + (wave >= 8 ? 1 : 0)); trickleCd = Math.max(2, 5.5 - wave * 0.25); }
    }

    // 적 이동/사격
    for (const e of enemies) {
      e.t += dt;
      if (e.type === 'sine') {
        e.x = e.x0! + e.amp! * Math.sin(e.omega! * e.t); // x(t)=x0+A·sin(ωt+φ)
        e.y += e.vy! * dt;
        e.shootCd! -= dt;
        if (e.shootCd! <= 0 && e.y > 0 && e.y < H * 0.65) {
          eShoot(e, 260 + wave * 10);
          e.shootCd = Math.max(0.9, 2 - wave * 0.07) + Math.random();
        }
      } else if (e.type === 'spiral') {
        if (e.t > 11) e.targetRad = 900; // 체류 시간 종료 → 나선 이탈
        e.rad! += (e.targetRad! - e.rad!) * (1 - Math.exp(-1.6 * dt));
        e.theta! += 1.5 * dt;
        e.x = e.cx! + e.rad! * Math.cos(e.theta!);
        e.y = e.cy! + e.rad! * Math.sin(e.theta!) * 0.55; // 타원 궤도
        e.shootCd! -= dt;
        if (e.shootCd! <= 0 && e.rad! < 400) {
          eShoot(e, 250 + wave * 9);
          e.shootCd = Math.max(1, 2.2 - wave * 0.07) + Math.random();
        }
      } else if (e.type === 'diver') {
        if (!e.armed) {
          e.y += 150 * dt;
          if (e.y > 30) { // 조준 벡터 확정 후 돌진
            const dx = player.x - e.x, dy = player.y - e.y, m = Math.hypot(dx, dy) || 1;
            e.vx = (dx / m) * e.spd!; e.vy = (dy / m) * e.spd!; e.armed = true;
          }
        } else { e.x += e.vx! * dt; e.y += e.vy! * dt; }
      } else if (e.type === 'launcher') {
        if (e.t > 13) e.ty = H + 220; // 체류 종료 → 하강 이탈
        e.y += (e.ty! - e.y) * (1 - Math.exp(-2 * dt));
        e.x += Math.sin(e.t * 0.9) * 40 * dt;
        e.shootCd! -= dt;
        if (e.shootCd! <= 0 && e.y > 40 && e.t < 13) { eHoming(e); e.shootCd = Math.max(1.6, 2.6 - wave * 0.06); }
      } else if (e.type === 'boss') {
        e.y += (e.ty! - e.y) * (1 - Math.exp(-1.5 * dt));
        e.x += (e.cx! + Math.sin(e.t * 0.7) * 150 - e.x) * (1 - Math.exp(-3 * dt));
        e.ringCd! -= dt; e.aimCd! -= dt;
        if (e.y > 100) {
          if (e.ringCd! <= 0) {
            e.spin! += Math.PI / e.ringN!; // 링 반 칸 회전 → 틈 이동
            eRing(e, 180 + wave * 6, e.ringN!, e.spin!);
            e.ringCd = Math.max(1.1, 2.2 - wave * 0.06);
          }
          if (e.aimCd! <= 0) { eSpread(e, 250 + wave * 8, 3, 0.5); e.aimCd = 1.4; }
        }
      } else if (e.type === 'final') {
        // 리사주 곡선 이동: x = cx + A·sin(at), y = cy + B·sin(bt + δ)
        if (!e.entered) {
          e.y += (160 - e.y) * (1 - Math.exp(-1.2 * dt));
          if (e.y > 150) { e.entered = true; e.t = 0; }
        } else {
          e.x = W / 2 + 210 * Math.sin(0.55 * e.t);
          e.y = 165 + 55 * Math.sin(0.9 * e.t - 0.2);
        }
        if (!e.entered) continue;
        const frac = e.hp / e.maxHp!;
        const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
        e.ringCd! -= dt; e.aimCd! -= dt; e.streamCd! -= dt; e.homCd! -= dt;
        if (phase === 1) {
          if (e.ringCd! <= 0) { e.spin! += Math.PI / 18; eRing(e, 200, 18, e.spin!); e.ringCd = 1.5; }
          if (e.aimCd! <= 0) { eSpread(e, 280, 3, 0.45); e.aimCd = 1.1; }
        } else if (phase === 2) {
          // 나선 스트림: 발사각 θ를 일정 증분으로 회전시키며 연사
          if (e.streamCd! <= 0) {
            e.streamAng! += 0.38;
            ebullets.push({ x: e.x, y: e.y, vx: Math.cos(e.streamAng!) * 230, vy: Math.sin(e.streamAng!) * 230, r: 5 });
            ebullets.push({ x: e.x, y: e.y, vx: Math.cos(e.streamAng! + Math.PI) * 230, vy: Math.sin(e.streamAng! + Math.PI) * 230, r: 5 });
            e.streamCd = 0.07;
          }
          if (e.ringCd! <= 0) { eSpread(e, 300, 5, 0.7); e.ringCd = 1.8; }
        } else {
          if (e.ringCd! <= 0) {
            e.spin! += Math.PI / 22;
            eRing(e, 210, 22, e.spin!);
            eRing(e, 160, 22, e.spin! + Math.PI / 22); // 이중 링 (속도차)
            e.ringCd = 1.5;
          }
          if (e.aimCd! <= 0) { eSpread(e, 310, 5, 0.6); e.aimCd = 1; }
          if (e.homCd! <= 0) { eHoming(e); e.homCd = 2.6; }
        }
      }
    }
    // 나선형은 진입 중 x가 화면 밖을 지나므로 반경으로만 이탈 판정
    enemies = enemies.filter(e => e.y < H + 80 && (e.type === 'spiral' ? e.rad! <= 850 : e.x > -160 && e.x < W + 160));

    // 아군 탄
    bullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    bullets = bullets.filter(b => b.y > -20 && b.x > -20 && b.x < W + 20);

    // 적 탄 (유도 조향 포함)
    for (const b of ebullets) {
      if (b.homing) {
        b.life! -= dt;
        const want = Math.atan2(player.y - b.y, player.x - b.x);
        let d = want - b.ang!;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const maxTurn = 2.6 * dt; // 각속도 제한 조향
        b.ang! += Math.max(-maxTurn, Math.min(maxTurn, d));
        b.vx = Math.cos(b.ang!) * b.spd!;
        b.vy = Math.sin(b.ang!) * b.spd!;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
    ebullets = ebullets.filter(b => b.y > -30 && b.y < H + 30 && b.x > -30 && b.x < W + 30 && (!b.homing || b.life! > 0));

    // 아이템
    for (const p of powerups) {
      p.t += dt;
      p.y += 130 * dt;
      p.x = p.x0 + Math.sin(p.t * 2.5) * 24; // 좌우 사인 흔들림
      const dx = p.x - player.x, dy = p.y - player.y;
      if (dx * dx + dy * dy < 30 * 30) {
        p.dead = true;
        if (player.weapon < 5) { player.weapon++; score += 200; addFloat(p.x, p.y, 'POWER UP! Lv.' + player.weapon, '#00ffc8'); SFX.power(); }
        else { score += 500; addFloat(p.x, p.y, 'MAX POWER +500', '#ffd700'); SFX.maxpower(); }
        boom(p.x, p.y, '#00ffc8', 10);
      }
    }
    powerups = powerups.filter(p => !p.dead && p.y < H + 30);
    floats.forEach(f => { f.y -= 45 * dt; f.life -= dt; });
    floats = floats.filter(f => f.life > 0);

    // 충돌: 아군 탄 vs 적 (원 충돌: |A-B| < r₁+r₂)
    for (const b of bullets) {
      for (const e of enemies) {
        const dx = b.x - e.x, dy = b.y - e.y;
        if (dx * dx + dy * dy < (e.r + 4) * (e.r + 4)) {
          b.dead = true; e.hp--;
          if (e.hp > 0) SFX.hit();
          particles.push({ x: b.x, y: b.y, vx: 0, vy: -60, life: 0.15, color: '#fff' });
          if (e.hp <= 0) killEnemy(e);
          break;
        }
      }
      if ((state as string) !== 'play') break;
    }
    bullets = bullets.filter(b => !b.dead);
    enemies = enemies.filter(e => !e.dead);
    if ((state as string) !== 'play') return;

    // 충돌: 적탄/적 vs 플레이어
    for (const b of ebullets) {
      const dx = b.x - player.x, dy = b.y - player.y;
      if (dx * dx + dy * dy < (b.r + player.r) * (b.r + player.r)) { b.y = H + 999; hitPlayer(); break; }
    }
    if ((state as string) !== 'play') return;
    for (const e of enemies) {
      const dx = e.x - player.x, dy = e.y - player.y;
      if (dx * dx + dy * dy < (e.r + player.r - 2) * (e.r + player.r - 2)) { hitPlayer(); break; }
    }

    score += dt * 10; // 생존 보너스
  }

  /* ===== 그리기 ===== */
  function drawShip(x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    if (player.inv > 0 && Math.floor(player.inv * 10) % 2 === 0) ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#00ffc8';
    ctx.beginPath();
    ctx.moveTo(0, -18); ctx.lineTo(13, 12); ctx.lineTo(0, 5); ctx.lineTo(-13, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb03a';
    ctx.beginPath();
    ctx.moveTo(-5, 12); ctx.lineTo(0, 20 + Math.random() * 6); ctx.lineTo(5, 12);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e: Enemy) {
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.type === 'final' || e.type === 'boss') {
      const R = e.r;
      ctx.fillStyle = e.type === 'final' ? '#ff5f9e' : '#b09aff';
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + e.t * 0.5;
        i === 0 ? ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R) : ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#07070f';
      ctx.beginPath(); ctx.arc(0, 0, R * 0.4, 0, 7); ctx.fill();
      ctx.fillStyle = e.type === 'final' ? '#ffd700' : '#ff5f9e';
      ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, 7); ctx.fill();
      const bw = e.type === 'final' ? 120 : 80;
      ctx.fillStyle = '#223';
      ctx.fillRect(-bw / 2, -R - 18, bw, 7);
      ctx.fillStyle = e.type === 'final' ? '#ffd700' : '#ff5f9e';
      ctx.fillRect(-bw / 2, -R - 18, bw * (e.hp / e.maxHp!), 7);
    } else if (e.type === 'launcher') {
      ctx.fillStyle = '#ffb03a';
      ctx.rotate(e.t * 0.8);
      ctx.fillRect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6);
      ctx.fillStyle = '#07070f';
      ctx.fillRect(-e.r * 0.35, -e.r * 0.35, e.r * 0.7, e.r * 0.7);
    } else if (e.type === 'diver') {
      const a = e.armed ? Math.atan2(e.vy!, e.vx!) : Math.PI / 2;
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = '#ff8f4a';
      ctx.beginPath();
      ctx.moveTo(0, 14); ctx.lineTo(10, -10); ctx.lineTo(0, -4); ctx.lineTo(-10, -10);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = e.type === 'spiral' ? '#6ea8ff' : '#ff5f9e';
      ctx.rotate(e.t * 2);
      ctx.beginPath();
      ctx.moveTo(0, -e.r); ctx.lineTo(e.r, 0); ctx.lineTo(0, e.r); ctx.lineTo(-e.r, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#07070f';
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.35, 0, 7); ctx.fill();
    }
    ctx.restore();
  }

  function drawPowerup(p: Powerup) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.strokeStyle = '#00ffc8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13 + Math.sin(p.t * 6) * 2, 0, 7); ctx.stroke();
    ctx.fillStyle = '#00ffc8';
    ctx.font = 'bold 15px Consolas, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('P', 0, 1);
    ctx.restore();
    ctx.textBaseline = 'alphabetic';
  }

  function drawEndScreen(title: string, titleColor: string, g: Grade) {
    ctx.fillStyle = 'rgba(7,7,15,.87)';
    ctx.fillRect(-30, -30, W + 60, H + 60);
    ctx.textAlign = 'center';
    ctx.fillStyle = titleColor;
    ctx.font = 'bold 54px "Malgun Gothic", sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 190);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 32px Consolas, monospace';
    ctx.fillText('SCORE  ' + Math.floor(score), W / 2, H / 2 - 125);
    ctx.fillStyle = g.color;
    ctx.shadowColor = g.color; ctx.shadowBlur = 30;
    ctx.font = 'bold 150px "Segoe UI", sans-serif';
    ctx.fillText(g.label, W / 2, H / 2 + 40);
    ctx.shadowBlur = 0;
    ctx.font = 'bold 28px "Malgun Gothic", sans-serif';
    ctx.fillText(g.msg, W / 2, H / 2 + 95);
    ctx.fillStyle = '#8892a6';
    ctx.font = '17px "Malgun Gothic", sans-serif';
    ctx.fillText('클릭 또는 스페이스바로 재시작', W / 2, H - 60);
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0, 0, W, H);
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 20, (Math.random() - 0.5) * shake * 20);

    ctx.fillStyle = '#2e3a58';
    stars.forEach(s => ctx.fillRect(s.x, s.y, s.s, s.s * 2));

    ctx.fillStyle = '#aefff0';
    for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 8, 4, 12);

    enemies.forEach(drawEnemy);
    powerups.forEach(drawPowerup);

    for (const b of ebullets) {
      ctx.fillStyle = b.homing ? '#ffb03a' : '#ff5f9e';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      if (b.homing) { // 미사일 꼬리
        ctx.strokeStyle = 'rgba(255,176,58,.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - Math.cos(b.ang!) * 14, b.y - Math.sin(b.ang!) * 14); ctx.stroke();
      }
    }

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // 떠오르는 안내 텍스트
    ctx.textAlign = 'center';
    ctx.font = 'bold 17px Consolas, monospace';
    for (const f of floats) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (state === 'play') drawShip(player.x, player.y);

    // UI
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 26px Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(Math.floor(score)).padStart(6, '0'), W - 20, 40);
    ctx.fillStyle = '#556';
    ctx.font = '14px Consolas, monospace';
    ctx.fillText('BEST ' + String(best).padStart(6, '0'), W - 20, 62);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff5f9e';
    ctx.font = 'bold 20px Consolas, monospace';
    ctx.fillText('♥'.repeat(Math.max(0, lives)), 20, 40);
    ctx.fillStyle = '#00ffc8';
    ctx.font = 'bold 15px Consolas, monospace';
    ctx.fillText('PW Lv.' + player.weapon, 20, 64);
    if (combo > 1) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 18px Consolas, monospace';
      ctx.fillText('x' + combo + ' COMBO', 20, 88);
    }
    ctx.fillStyle = '#445';
    ctx.font = '14px Consolas, monospace';
    ctx.fillText('WAVE ' + wave + ' / ' + CONFIG.finalWave, 20, H - 16);
    ctx.textAlign = 'right';
    ctx.fillText('M: 소리 ' + (sound.muted ? 'OFF' : 'ON'), W - 20, H - 16);
    ctx.textAlign = 'left';

    // 웨이브 알림
    if (waveMsgT > 0 && state === 'play') {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, waveMsgT * 2);
      ctx.fillStyle = wave >= CONFIG.finalWave ? '#ffd700' : '#b09aff';
      ctx.font = 'bold 40px "Malgun Gothic", sans-serif';
      ctx.fillText(wave >= CONFIG.finalWave ? '⚠ FINAL BOSS ⚠' : 'WAVE ' + wave, W / 2, H / 2 - 160);
      ctx.globalAlpha = 1;
    }

    if (state === 'ready') {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#b09aff';
      ctx.font = 'bold 46px "Malgun Gothic", sans-serif';
      ctx.fillText('벡터 스트라이크', W / 2, H / 2 - 120);
      ctx.fillStyle = '#e8f0ff';
      ctx.font = '19px "Malgun Gothic", sans-serif';
      ctx.fillText('마우스 또는 방향키로 이동 · 공격은 자동', W / 2, H / 2 - 55);
      ctx.fillText('P 아이템: 무기 강화 (최대 Lv.5) · 피격 시 1단계 하락!', W / 2, H / 2 - 22);
      ctx.fillText('웨이브 ' + CONFIG.finalWave + '의 최종보스를 격파하면 클리어!', W / 2, H / 2 + 11);
      ctx.fillStyle = '#8892a6';
      ctx.fillText('클릭 또는 스페이스바로 시작', W / 2, H / 2 + 70);
    }

    if (state === 'over') drawEndScreen('GAME OVER', '#ff5f5f', gradeOf(CONFIG.grades, Math.floor(score)));
    if (state === 'clear') drawEndScreen('★ MISSION CLEAR! ★', '#ffd700', gradeOf(CONFIG.grades, Math.floor(score)));

    ctx.restore();
  }

  /* ===== 메인 루프 ===== */
  let rafId = 0;
  let last = performance.now();
  function loop(now: number) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);

  return () => {
    ab.abort();
    cancelAnimationFrame(rafId);
    sound.stopMusic();
  };
}
