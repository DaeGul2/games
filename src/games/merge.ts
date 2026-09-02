/**
 * K-푸드 합치기 — 수박게임 규칙의 물리 퍼즐
 *
 * 위에서 음식을 하나씩 떨어뜨리고, **같은 음식 둘이 닿으면 한 단계 위로 진화**한다.
 * 상자 밖으로 넘치면 끝. 제한시간은 없다 — 천천히 생각하고 놓는 게 이 장르의 맛이다.
 *
 * ── 구현에서 진짜 어려운 곳은 물리가 아니라 '합치기'다
 *   1) 중복 합체 — A가 같은 프레임에 B, C 양쪽과 닿으면 A가 두 번 소비돼 음식이 복제된다.
 *      그래서 충돌 순간에 합치지 않고 플래그를 세워 큐에 넣고, 물리 스텝이 끝난 뒤 처리한다.
 *   2) 놓친 접촉 — 잠든 몸체끼리는 collisionStart가 다시 오지 않는다. 그래서 몇 프레임마다
 *      같은 단계끼리 실제로 겹쳐 있는지 훑는 **안전망**을 따로 돌린다.
 *   3) 합체 지점 — 두 몸체의 질량중심에 만들고 운동량을 이어받게 한다. 안 그러면 탑이 튄다.
 *
 * ── 점수
 *   삼각수 Tₙ = n(n+1)/2. 등차면 큰 걸 만들 이유가 없고, 지수면 후반이 폭주한다.
 *   최종 단계(떡뽁이) 둘을 합치면 원작의 수박처럼 **사라지고** 큰 보너스를 준다 — 자리를 비워주는 보상.
 */
import { Bodies, Body, Composite, Engine, Events, type Pair } from 'matter-js';
import { sound, type Pattern } from '../lib/sound';
import { gradeOf, saveScore, getBest, KEYS, type Grade } from '../lib/score';
import { Quality } from '../lib/perf';
import { drawInCircle } from '../lib/sprites';
import { LEVELS, MAX_LEVEL, pickDropLevel, type MergeLevel } from './mergeFoods';
import { T, FONT, tr } from '../i18n';

/* ===== 설정 (부스 운영 중 조정 가능) ===== */
const CONFIG = {
  grades: [
    // 문턱은 엔진 시뮬레이션으로 정했다. 세 종류 AI를 24판씩 돌린 점수 분포:
    //   막 놓는 초보 493~1027(중앙 728) · 같은 것 위에 놓는 평균 1118~1968(중앙 1400)
    //   큰 것을 벽으로 모는 요령파 1363~3194(중앙 1902)
    // → 초보는 C, 평균은 B, 잘하면 A, S는 드물게 나오도록 잡았다.
    { min: 2500, label: 'S', color: '#ffd700', get msg() { return T.merge.gradeS; } },
    { min: 1700, label: 'A', color: '#ff5f9e', get msg() { return T.grade.A; } },
    { min: 1100, label: 'B', color: '#00ffc8', get msg() { return T.grade.B; } },
    { min: 500, label: 'C', color: '#6ea8ff', get msg() { return T.grade.C; } },
    { min: 0, label: 'D', color: '#8892a6', get msg() { return T.grade.D; } },
  ] as Grade[],
  dropCooldown: 0.34,   // 연타 방지
  overGrace: 1.2,       // 선 위에 이만큼 머물러야 게임오버 (떨어뜨리는 순간은 봐준다)
  moveSpeed: 340,       // 키보드 조준 속도 px/s
};

/* ===== BGM ===== */
const BGM: Pattern = {
  kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
  hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  bass: [110, 0, 0, 0, 147, 0, 0, 0, 131, 0, 0, 0, 98, 0, 0, 0],
  lead: [440, 0, 587, 0, 0, 523, 0, 0, 494, 0, 392, 0, 0, 440, 0, 0],
};

const SFX = {
  drop: () => sound.tone({ f: 620, f2: 300, dur: 0.1, type: 'triangle', vol: 0.12 }),
  /** 단계가 높을수록 높은 음 — 진화가 귀로도 느껴지게 */
  merge: (lv: number) => {
    const f = 280 * Math.pow(2, lv / 6);
    sound.tone({ f, f2: f * 1.5, dur: 0.11, vol: 0.16 });
    sound.tone({ f: f * 1.5, dur: 0.09, vol: 0.1, when: 0.06 });
  },
  big: () => [523, 659, 784, 1047, 1319].forEach((f, i) =>
    sound.tone({ f, dur: 0.14, vol: 0.2, when: i * 0.08 })),
  warn: () => sound.tone({ f: 300, f2: 220, dur: 0.16, type: 'sawtooth', vol: 0.1 }),
  over: () => { sound.noise({ dur: 0.6, vol: 0.4, fc: 700 }); sound.tone({ f: 240, f2: 40, dur: 0.65, type: 'sawtooth', vol: 0.3 }); },
};

function gradeJingle(label: string) {
  const seq: Record<string, number[]> = {
    S: [523, 659, 784, 1047, 1319], A: [523, 659, 784, 1047], B: [523, 659, 784], C: [440, 554], D: [330, 262],
  };
  (seq[label] ?? seq.D).forEach((f, i) => sound.tone({ f, dur: 0.16, vol: 0.18, when: 0.5 + i * 0.13 }));
}

/* ===== 조각 ===== */
interface Piece {
  body: Body;
  def: MergeLevel;
  /** 합체 예약됨 — 같은 프레임에 두 번 소비되는 것을 막는다 */
  merging: boolean;
  /** 갓 생겨난 뒤의 '뽁' 하는 확대 연출 */
  pop: number;
  /** 선 위에 머문 시간 */
  overT: number;
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }
interface Popup { x: number; y: number; text: string; color: string; life: number }

type State = 'ready' | 'play' | 'over';

export function createMerge(cv: HTMLCanvasElement): () => void {
  const W = 640, H = 700;
  const ctx = cv.getContext('2d', { alpha: false })!;
  const fit = Math.min(1, (innerWidth - 40) / W, Math.max(0.5, (innerHeight - 210) / H));
  const quality = new Quality(cv, ctx, W, H, fit);

  /* 상자 — 왼쪽에 두고 오른쪽은 진화표 자리.
     폭 300 x 높이 440은 시뮬레이션으로 정했다. 더 넓으면 합쳐서 생기는 공간이
     쌓이는 속도를 이겨 판이 끝나지 않고(430폭에서는 12판 중 6판이 안 죽었다),
     더 좁으면 큰 음식이 들어갈 자리가 없어 후반이 답답해진다. */
  const BOX_L = 64, BOX_R = 386;   // 폭 322 — 후반 답답함 피드백으로 +22
  const FLOOR_Y = 620;
  const LINE_Y = 150;          // 이 선 위로 넘치면 안 된다 (더 위로 — 쌓을 공간 확대)
  const DROP_Y = 116;          // 조준 위치 — 가장 큰 낙하 음식(r=30)도 선 위에 머문다
  const WALL_TOP = 56;         // 물리 벽은 조준 지점보다 위에서 시작해야 옆으로 새지 않는다
  const WALL = 14;
  const KEY = KEYS.merge;

  /* ===== 물리 세계 ===== */
  const engine = Engine.create();
  engine.gravity.y = 1;
  engine.positionIterations = 10;
  engine.velocityIterations = 8;
  // 잠들기 끄기 — Matter는 받침이 사라져도 잠든 몸체를 깨우지 않아 구슬이 공중에/벽에 붙어 있었다.
  // 깨우는 휴리스틱(wakeUnsupported)으로 두 번 고쳤지만 케이스가 계속 새어 나와, 원인을 없앤다.
  // 조각은 많아야 60개 안팎이라 항상 시뮬레이션해도 비용은 무시할 수준.
  engine.enableSleeping = false;

  const sideH = FLOOR_Y - WALL_TOP;
  const walls = [
    Bodies.rectangle((BOX_L + BOX_R) / 2, FLOOR_Y + WALL / 2, BOX_R - BOX_L + WALL * 2, WALL, { isStatic: true, friction: 0.6 }),
    Bodies.rectangle(BOX_L - WALL / 2, WALL_TOP + sideH / 2, WALL, sideH, { isStatic: true, friction: 0.05 }),
    Bodies.rectangle(BOX_R + WALL / 2, WALL_TOP + sideH / 2, WALL, sideH, { isStatic: true, friction: 0.05 }),
  ];
  Composite.add(engine.world, walls);

  /* ===== 상태 ===== */
  let state: State = 'ready';
  let pieces: Piece[] = [];
  let score = 0, best = getBest(KEY), maxLevel = 1, merges = 0;
  let cur = pickDropLevel(), next = pickDropLevel();
  let aimX = (BOX_L + BOX_R) / 2;
  let cooldown = 0, overT = 0, dangerPulse = 0, shake = 0;
  let showFps = false;
  const particles: Particle[] = [];
  const popups: Popup[] = [];
  const pending: [Piece, Piece][] = [];
  let sweepT = 0;

  const defOf = (lv: number) => LEVELS[lv - 1];
  const clampAim = (x: number, r: number) =>
    Math.max(BOX_L + r + 2, Math.min(BOX_R - r - 2, x));

  /* ===== 조각 생성 ===== */
  function spawn(lv: number, x: number, y: number, vx = 0, vy = 0): Piece {
    const def = defOf(lv);
    const body = Bodies.circle(x, y, def.r, {
      restitution: 0.12,
      friction: 0.34,
      frictionStatic: 0.5,
      density: 0.0012,
      slop: 0.02,
    });
    Body.setVelocity(body, { x: vx, y: vy });
    Composite.add(engine.world, body);
    const p: Piece = { body, def, merging: false, pop: 0, overT: 0 };
    pieces.push(p);
    return p;
  }

  function byBody(b: Body) {
    for (const p of pieces) if (p.body === b) return p;
    return null;
  }

  function remove(p: Piece) {
    Composite.remove(engine.world, p.body);
    const i = pieces.indexOf(p);
    if (i >= 0) pieces.splice(i, 1);
  }

  /* ===== 합치기 =====
   * 충돌 순간에는 예약만 한다. 실제 처리는 물리 스텝이 끝난 뒤 — 한 조각이
   * 같은 프레임에 두 번 소비되어 음식이 복제되는 것을 막기 위해서다.
   */
  function queueMerge(a: Piece, b: Piece) {
    if (a === b || a.merging || b.merging) return;
    if (a.def.level !== b.def.level) return;
    a.merging = true;
    b.merging = true;
    pending.push([a, b]);
  }

  Events.on(engine, 'collisionStart', (e: { pairs: Pair[] }) => {
    if (state !== 'play') return;
    for (const pair of e.pairs) {
      const a = byBody(pair.bodyA), b = byBody(pair.bodyB);
      if (a && b) queueMerge(a, b);
    }
  });

  /** 안전망 — 잠든 몸체끼리는 collisionStart가 다시 오지 않으므로 직접 훑는다 */
  function sweep() {
    for (let i = 0; i < pieces.length; i++) {
      const a = pieces[i];
      if (a.merging) continue;
      for (let j = i + 1; j < pieces.length; j++) {
        const b = pieces[j];
        if (b.merging || a.def.level !== b.def.level) continue;
        const dx = a.body.position.x - b.body.position.x;
        const dy = a.body.position.y - b.body.position.y;
        const rr = a.def.r + b.def.r;
        if (dx * dx + dy * dy <= rr * rr) { queueMerge(a, b); break; }
      }
    }
  }

  function burst(x: number, y: number, color: string, n: number, spd: number) {
    if (quality.low) n = Math.max(4, n >> 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const s = spd * (0.4 + Math.random() * 0.8);
      particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.5 + Math.random() * 0.35, max: 0.85, color, r: 2 + Math.random() * 2.4,
      });
    }
  }

  function resolveMerges() {
    while (pending.length) {
      const [a, b] = pending.pop()!;
      // 큐에 들어간 사이 한쪽이 이미 사라졌을 수 있다
      if (!pieces.includes(a) || !pieces.includes(b)) continue;

      const lv = a.def.level;
      const x = (a.body.position.x + b.body.position.x) / 2;
      const y = (a.body.position.y + b.body.position.y) / 2;
      const vx = (a.body.velocity.x + b.body.velocity.x) / 2;
      const vy = (a.body.velocity.y + b.body.velocity.y) / 2;
      remove(a);
      remove(b);
      merges++;

      if (lv >= MAX_LEVEL) {
        // 원작의 수박처럼 — 최종 단계끼리는 사라지고 자리를 비운다
        const bonus = LEVELS[MAX_LEVEL - 1].score * 4;
        score += bonus;
        popups.push({ x, y, text: `+${bonus}`, color: '#ffd700', life: 1.4 });
        burst(x, y, '#ffd700', 34, 320);
        shake = 12;
        SFX.big();
        continue;
      }

      const np = spawn(lv + 1, x, y, vx, vy);
      np.pop = 1;
      const gained = np.def.score;
      score += gained;
      if (np.def.level > maxLevel) maxLevel = np.def.level;
      popups.push({ x, y: y - np.def.r * 0.4, text: `+${gained}`, color: np.def.color, life: 0.95 });
      burst(x, y, np.def.color, 10 + lv, 90 + lv * 16);
      SFX.merge(lv);
    }
  }

  /* ===== 진행 ===== */
  function reset() {
    for (const p of pieces) Composite.remove(engine.world, p.body);
    pieces = [];
    pending.length = 0;
    particles.length = 0;
    popups.length = 0;
    score = 0; maxLevel = 1; merges = 0;
    cur = pickDropLevel(); next = pickDropLevel();
    aimX = (BOX_L + BOX_R) / 2;
    cooldown = 0; dangerPulse = 0; shake = 0;
    sound.startMusic(BGM, () => 104);
    state = 'play';
  }

  function drop() {
    if (cooldown > 0) return;
    const def = defOf(cur);
    const x = clampAim(aimX, def.r);
    spawn(cur, x, DROP_Y);
    cur = next;
    next = pickDropLevel();
    cooldown = CONFIG.dropCooldown;
    SFX.drop();
  }

  function gameOver() {
    state = 'over';
    overT = performance.now();
    shake = 16;
    sound.stopMusic();
    SFX.over();
    best = saveScore(KEY, score, CONFIG.grades);
    gradeJingle(gradeOf(CONFIG.grades, score).label);
  }

  /* ===== 입력 ===== */
  const held = new Set<string>();
  const ac = new AbortController();
  const opts = { signal: ac.signal };

  function press() {
    sound.ensure();
    if (state === 'ready') { reset(); return; }
    if (state === 'over') { if (performance.now() - overT > 700) reset(); return; }
    drop();
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
  cv.addEventListener('pointermove', e => { if (state === 'play') aimX = localX(e); }, opts);
  cv.addEventListener('pointerdown', e => { if (state === 'play') aimX = localX(e); press(); }, opts);

  /* ===== 업데이트 ===== */
  let acc = 0;
  const STEP = 1000 / 60;

  function update(dt: number) {
    if (cooldown > 0) cooldown -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (dangerPulse > 0) dangerPulse -= dt;

    if (state === 'play') {
      const r = defOf(cur).r;
      if (held.has('ArrowLeft')) aimX -= CONFIG.moveSpeed * dt;
      if (held.has('ArrowRight')) aimX += CONFIG.moveSpeed * dt;
      aimX = clampAim(aimX, r);
    }

    // 물리는 고정 스텝 — 프레임률이 흔들려도 결과가 흔들리지 않게
    acc += dt * 1000;
    if (acc > 120) acc = 120;
    while (acc >= STEP) {
      Engine.update(engine, STEP);
      acc -= STEP;
    }
    resolveMerges();

    sweepT += dt;
    if (sweepT > 0.2) { sweepT = 0; sweep(); resolveMerges(); }

    for (const p of pieces) if (p.pop > 0) p.pop = Math.max(0, p.pop - dt * 5);

    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life -= dt;
      if (q.life <= 0) { particles.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 900 * dt; q.vx *= 0.98;
    }
    for (let i = popups.length - 1; i >= 0; i--) {
      popups[i].life -= dt;
      popups[i].y -= 34 * dt;
      if (popups[i].life <= 0) popups.splice(i, 1);
    }

    /* 넘침 판정 — 선에 닿는 순간이 아니라 선 위에 머물러야 종료.
       떨어지는 중인 조각은 세지 않는다 (놓는 순간은 항상 선 위에 있으므로) */
    if (state === 'play') {
      let warn = false;
      for (const p of pieces) {
        const top = p.body.position.y - p.def.r;
        const settled = p.body.speed < 0.9;
        if (top < LINE_Y && settled) {
          p.overT += dt;
          warn = true;
          if (p.overT > CONFIG.overGrace) { gameOver(); return; }
        } else {
          p.overT = 0;
        }
      }
      if (warn && dangerPulse <= 0) { dangerPulse = 0.5; SFX.warn(); }
    }
  }

  /* ===== 그리기 ===== */
  function drawBubble(x: number, y: number, def: MergeLevel, pop: number, alpha = 1) {
    const r = def.r * (1 + pop * 0.22);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;

    // 유리구슬
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.36, r * 0.1, 0, 0, r);
    g.addColorStop(0, def.color + 'ee');
    g.addColorStop(0.55, def.color + '88');
    g.addColorStop(1, def.color + '2e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // 음식 (구슬에 내접)
    drawInCircle(ctx, def.key, r, 0.9);

    // 테두리 + 광택
    ctx.strokeStyle = def.color;
    ctx.lineWidth = Math.max(1.4, r * 0.055);
    ctx.beginPath();
    ctx.arc(0, 0, r - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = Math.max(1.2, r * 0.06);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.76, Math.PI * 1.05, Math.PI * 1.5);
    ctx.stroke();

    ctx.restore();
  }

  function drawBox() {
    const top = WALL_TOP;
    // 안쪽 바닥
    ctx.fillStyle = 'rgba(20,22,44,.55)';
    ctx.fillRect(BOX_L, top, BOX_R - BOX_L, FLOOR_Y - top);

    // 벽 — 급식 트레이 느낌
    const g = ctx.createLinearGradient(0, top, 0, FLOOR_Y);
    g.addColorStop(0, '#4a5273');
    g.addColorStop(0.35, '#5b6486');
    g.addColorStop(1, '#2b3050');
    ctx.fillStyle = g;
    ctx.fillRect(BOX_L - WALL, top, WALL, FLOOR_Y - top + WALL);
    ctx.fillRect(BOX_R, top, WALL, FLOOR_Y - top + WALL);
    ctx.fillRect(BOX_L - WALL, FLOOR_Y, BOX_R - BOX_L + WALL * 2, WALL);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(BOX_L - WALL, top, WALL, 3);
    ctx.fillRect(BOX_R, top, WALL, 3);

    // 넘침 경계선
    const danger = dangerPulse > 0;
    ctx.strokeStyle = danger ? `rgba(255,95,120,${0.5 + Math.sin(dangerPulse * 30) * 0.4})` : 'rgba(255,120,140,.32)';
    ctx.lineWidth = 2;
    ctx.setLineDash([9, 8]);
    ctx.beginPath();
    ctx.moveTo(BOX_L, LINE_Y);
    ctx.lineTo(BOX_R, LINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawPanel() {
    const px = BOX_R + 40;
    ctx.textAlign = 'left';

    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 30px Consolas, monospace';
    ctx.fillText(String(score).padStart(5, '0'), px, 60);
    ctx.fillStyle = '#556';
    ctx.font = '12px Consolas, monospace';
    ctx.fillText('BEST ' + String(best).padStart(5, '0'), px, 80);

    // 다음
    ctx.fillStyle = '#4a5070';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(T.common.next, px, 112);
    const nd = defOf(next);
    drawBubble(px + 40, 146, nd, 0, 1);
    ctx.fillStyle = '#cfd7f5';
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(nd.name, px + 40, 190);

    // 진화표 — 지금 어디까지 왔는지, 다음이 무엇인지 한눈에
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4a5070';
    ctx.font = `11px ${FONT}`;
    ctx.fillText(T.merge.evolution, px, 222);
    LEVELS.forEach((d, i) => {
      const y = 244 + i * 33;
      const got = d.level <= maxLevel;
      ctx.globalAlpha = got ? 1 : 0.3;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(px + 10, y, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = got ? '#dfe6ff' : '#7b83a4';
      ctx.font = (d.level === maxLevel ? 'bold ' : '') + `12px ${FONT}`;
      ctx.fillText(d.name, px + 26, y + 4);
      ctx.globalAlpha = 1;
      if (i < LEVELS.length - 1) {
        ctx.strokeStyle = 'rgba(120,130,200,.18)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + 10, y + 9);
        ctx.lineTo(px + 10, y + 24);
        ctx.stroke();
      }
    });
  }

  function drawAim() {
    const def = defOf(cur);
    const x = clampAim(aimX, def.r);
    ctx.save();
    ctx.strokeStyle = def.color + '66';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 8]);
    ctx.beginPath();
    ctx.moveTo(x, DROP_Y + def.r + 4);
    ctx.lineTo(x, FLOOR_Y - 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    drawBubble(x, DROP_Y, def, 0, cooldown > 0 ? 0.35 : 1);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    ctx.fillStyle = '#1c2343';
    ctx.fillRect(0, 0, W, H);

    drawBox();
    for (const p of pieces) drawBubble(p.body.position.x, p.body.position.y, p.def, p.pop);

    for (const q of particles) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = 'center';
    for (const u of popups) {
      ctx.globalAlpha = Math.min(1, u.life * 1.8);
      ctx.fillStyle = u.color;
      ctx.font = 'bold 20px Consolas, monospace';
      ctx.fillText(u.text, u.x, u.y);
    }
    ctx.globalAlpha = 1;

    if (state === 'play') drawAim();
    drawPanel();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b74a0';
    ctx.font = '11px Consolas, monospace';
    ctx.fillText(T.merge.keys, 20, H - 16);
    if (showFps) {
      ctx.textAlign = 'right';
      ctx.fillText(quality.fps.toFixed(0) + ' FPS · x' + quality.scale.toFixed(1), W - 20, H - 16);
    }

    if (state === 'ready') drawReady();
    if (state === 'over') drawOver();
    ctx.restore();
  }

  function drawReady() {
    ctx.fillStyle = 'rgba(5,5,12,.9)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff8a5c';
    ctx.font = `bold 44px ${FONT}`;
    ctx.fillText(T.merge.title, W / 2, 150);
    ctx.fillStyle = '#8892a6';
    ctx.font = `17px ${FONT}`;
    ctx.fillText(T.merge.intro1, W / 2, 190);
    ctx.fillStyle = '#5b6480';
    ctx.font = `14px ${FONT}`;
    ctx.fillText(T.merge.intro2, W / 2, 218);

    // 체인 미리보기
    let x = 70;
    const y = 300;
    LEVELS.slice(0, 6).forEach(d => {
      drawBubble(x, y, d, 0, 1);
      x += d.r + (LEVELS[d.level] ? LEVELS[d.level].r : d.r) + 14;
    });
    ctx.fillStyle = '#4a5070';
    ctx.font = `13px ${FONT}`;
    ctx.fillText(T.merge.chain, W / 2, 396);

    ctx.fillStyle = '#cfd7f5';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(T.merge.intro3, W / 2, 448);
    ctx.fillText(T.merge.intro4, W / 2, 474);
    ctx.fillStyle = '#8892a6';
    ctx.font = `16px ${FONT}`;
    ctx.fillText(T.merge.start, W / 2, H - 90);
  }

  function drawOver() {
    ctx.fillStyle = 'rgba(10,10,18,.86)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    const g = gradeOf(CONFIG.grades, score);
    ctx.fillStyle = '#e8f0ff';
    ctx.font = 'bold 28px Consolas, monospace';
    ctx.fillText('SCORE  ' + score, W / 2, H / 2 - 130);
    ctx.fillStyle = g.color;
    ctx.shadowColor = g.color;
    ctx.shadowBlur = 30;
    ctx.font = 'bold 130px "Segoe UI", sans-serif';
    ctx.fillText(g.label, W / 2, H / 2);
    ctx.shadowBlur = 0;
    ctx.font = `bold 26px ${FONT}`;
    ctx.fillText(g.msg, W / 2, H / 2 + 46);

    const top = defOf(maxLevel);
    ctx.fillStyle = '#cfd7f5';
    ctx.font = `16px ${FONT}`;
    ctx.fillText(tr(T.merge.over, { name: top.name, n: merges }), W / 2, H / 2 + 88);
    drawBubble(W / 2, H / 2 + 150, top, 0, 1);
    ctx.fillStyle = '#8892a6';
    ctx.font = `15px ${FONT}`;
    ctx.fillText(tr(T.common.best, { n: best }), W / 2, H / 2 + 150 + top.r + 26);
    ctx.fillText(T.merge.restart, W / 2, H - 60);
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
    Events.off(engine, 'collisionStart');
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  };
}
