/**
 * K-푸드 타워 — 물리 기반 쌓기 게임 엔진
 *
 * '동물 타워 배틀'의 규칙을 K-푸드로 옮긴 것. 게임 로직이라 부를 만한 게 거의 없다.
 * 재미의 원천을 코드로 만들지 않고 **강체 물리에 위탁**한다.
 *
 *   - 음식은 폴리곤/원 콜라이더를 가진 2D 강체. 작용하는 힘은 중력뿐.
 *   - 안정 조건은 고전역학 그대로: ΣF = 0 이고 Στ = 0.
 *     토크 τ = d·mg (d = 지지점에서 무게중심까지의 수평거리)
 *     → 무게중심이 지지 구간 안에 들어오면 안 넘어간다. G키로 이걸 눈으로 볼 수 있다.
 *   - 난수는 다음 음식 뽑기에만 쓴다. "같이 놓은 것 같은데 결과가 다른" 느낌은
 *     난수가 아니라 접촉 해석의 초기조건 민감성(카오스)에서 나온다.
 *
 * 모드
 *   혼자 — 무너질 때까지 쌓기. 점수·등급이 나오고 기록에 저장된다 (부스 운영 흐름)
 *   둘이 — 번갈아 쌓고 먼저 떨어뜨린 쪽이 패배 (원작 규칙)
 */
import { Bodies, Body, Composite, Engine, Vertices, type Vector, type Vertex } from 'matter-js';
import { sound, type Pattern } from '../lib/sound';
import { gradeOf, saveScore, getBest, KEYS, type Grade } from '../lib/score';
import { Quality } from '../lib/perf';
import { FOODS, pickFood, type FoodDef } from './towerFoods';

/* ===== 설정 (부스 운영 중 조정 가능) ===== */
const CONFIG = {
  grades: [
    { min: 3200, label: 'S', color: '#ffd700', msg: '전설의 요리사!' },
    { min: 2200, label: 'A', color: '#ff5f9e', msg: '대단해요!' },
    { min: 1200, label: 'B', color: '#00ffc8', msg: '잘했어요!' },
    { min: 500, label: 'C', color: '#6ea8ff', msg: '좋아요!' },
    { min: 0, label: 'D', color: '#8892a6', msg: '다시 도전!' },
  ] as Grade[],
  plateW: 252,
  turnTime: 15,        // 턴 제한시간(초). 넘기면 자동 낙하 — 부스 회전율을 위해
  moveSpeed: 300,      // px/s
  rotSpeed: 2.5,       // rad/s
  settleMin: 0.35,     // 낙하 후 최소 관찰 시간
  settleMax: 4,        // 이 시간이 지나면 흔들려도 안착으로 본다
};

/* ===== BGM — 느긋한 4/4. 쌓는 동안 초조해지지 않게 ===== */
const BGM: Pattern = {
  kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  bass: [98, 0, 0, 0, 131, 0, 0, 0, 110, 0, 0, 0, 87, 0, 0, 0],
  lead: [392, 0, 523, 0, 0, 587, 0, 0, 523, 0, 440, 0, 0, 392, 0, 0],
};

const SFX = {
  move: () => sound.tone({ f: 620, dur: 0.03, vol: 0.045, type: 'square' }),
  rot: () => sound.tone({ f: 880, f2: 1100, dur: 0.05, vol: 0.07 }),
  drop: () => sound.tone({ f: 700, f2: 240, dur: 0.16, type: 'triangle', vol: 0.14 }),
  land: () => { sound.tone({ f: 150, f2: 95, dur: 0.09, type: 'sine', vol: 0.3 }); sound.noise({ dur: 0.06, vol: 0.1, fc: 900 }); },
  wobble: () => sound.tone({ f: 240, f2: 200, dur: 0.08, type: 'triangle', vol: 0.12 }),
  place: () => [523, 784].forEach((f, i) => sound.tone({ f, dur: 0.08, vol: 0.13, when: i * 0.06 })),
  crash: () => { sound.noise({ dur: 0.55, vol: 0.42, fc: 700 }); sound.tone({ f: 240, f2: 40, dur: 0.6, type: 'sawtooth', vol: 0.3 }); },
  tick: () => sound.tone({ f: 1200, dur: 0.03, vol: 0.08 }),
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
  def: FoodDef;
  /** 로컬 원점 → 무게중심 오프셋. 그림을 물리 좌표에 맞추는 데 쓴다 */
  off: Vector;
  /** 어느 플레이어가 놓았는지 (둘이 모드 표시용) */
  owner: 0 | 1 | 2;
  t: number;
}

type Mode = 'solo' | 'duo';
type State = 'menu' | 'aim' | 'fall' | 'over';

export function createTower(cv: HTMLCanvasElement): () => void {
  const W = 720, H = 620;
  const ctx = cv.getContext('2d', { alpha: false })!;
  const fit = Math.min(1, (innerWidth - 40) / W, Math.max(0.5, (innerHeight - 210) / H));
  const quality = new Quality(cv, ctx, W, H, fit);

  const PLATE_Y = H - 96;
  const KILL_Y = PLATE_Y + 150;   // 이 아래로 내려가면 떨어진 것
  const KEY = KEYS.tower;

  /* ===== 물리 세계 ===== */
  const engine = Engine.create();
  engine.gravity.y = 1;
  // 쌓기 게임은 접촉 해석의 정확도가 곧 게임성이다. 기본값보다 반복 횟수를 올린다.
  engine.positionIterations = 12;
  engine.velocityIterations = 10;
  engine.constraintIterations = 4;
  engine.enableSleeping = true;

  const plate = Bodies.rectangle(W / 2, PLATE_Y + 9, CONFIG.plateW, 18, {
    isStatic: true, friction: 0.95, frictionStatic: 1, restitution: 0,
  });
  Composite.add(engine.world, plate);

  /* ===== 상태 ===== */
  let state: State = 'menu';
  let mode: Mode = 'solo';
  let pieces: Piece[] = [];
  let score = 0, best = getBest(KEY), placed = 0;
  let turn = 0;
  let player: 1 | 2 = 1;
  let winner: 0 | 1 | 2 = 0;       // 둘이 모드 승자
  let cur: FoodDef = FOODS[0];
  let next: FoodDef = FOODS[1];
  let aimX = W / 2, aimAngle = 0;
  let turnLeft = CONFIG.turnTime, lastTickSec = 99;
  let fallT = 0, overT = 0;
  let camY = 0, camTarget = 0;
  let showCom = false, showFps = false;
  let shake = 0;
  let toast = '', toastT = 0;
  const stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * W, y: Math.random() * H,
    s: Math.random() * 1.6 + 0.4, a: Math.random() * 0.5 + 0.15,
  }));

  /* ===== 강체 생성 =====
   * Matter는 볼록 도형만 정확히 다룬다. 정의된 조각을 Vertices.hull로 한 번 걸러
   * 볼록성을 보장하고, 조각의 원래 로컬 위치를 유지하도록 무게중심에 맞춰 배치한다.
   */
  function makeBody(def: FoodDef, x: number, y: number, angle: number): Piece {
    const opts = {
      friction: def.friction,
      frictionStatic: def.frictionStatic,
      restitution: def.restitution,
      density: def.density,
      slop: 0.02,
      sleepThreshold: 40,
    };
    const parts = def.parts.map(p => {
      if (p.circle) return Bodies.circle(p.circle.x, p.circle.y, p.circle.r, opts);
      // Matter 런타임은 평범한 {x,y}를 받지만 타입은 Vertex를 요구한다
      const vs = p.verts!.map(([vx, vy]) => ({ x: vx, y: vy })) as unknown as Vertex[];
      const hull = Vertices.hull(vs);
      const c = Vertices.centre(hull);
      return Bodies.fromVertices(c.x, c.y, [hull], opts);
    });
    const body = parts.length === 1 ? parts[0] : Body.create({ parts });
    // 이 시점의 position이 곧 로컬 원점 기준 무게중심
    const off = { x: body.position.x, y: body.position.y };
    Body.setAngle(body, angle);
    Body.setPosition(body, { x, y });
    return { body, def, off, owner: mode === 'duo' ? player : 0, t: 0 };
  }

  /* ===== 진행 ===== */
  /**
   * 낙하 시작 지점. 탑 바로 위(85px)에서 놓는다 — 고정 높이로 두면 초반 낙하거리가
   * 400px에 달해 착지 충격만으로 탑이 흩어진다. 단 화면 상단 HUD 아래로는 올리지 않는다.
   */
  function spawnY() {
    return Math.max(-camY + 130, towerTop() - 85);
  }

  /** 접시 위를 치운다 (메뉴 복귀·재시작 공통) */
  function clearWorld() {
    for (const p of pieces) Composite.remove(engine.world, p.body);
    pieces = [];
    camY = 0;
    camTarget = 0;
  }

  function toMenu() {
    sound.stopMusic();
    clearWorld();
    state = 'menu';
  }

  function reset(m: Mode) {
    mode = m;
    clearWorld();
    score = 0; placed = 0; turn = 0; player = 1; winner = 0;
    camY = 0; camTarget = 0; shake = 0;
    cur = pickFood(0); next = pickFood(1);
    aimX = W / 2; aimAngle = 0;
    turnLeft = CONFIG.turnTime; lastTickSec = 99;
    toast = ''; toastT = 0;
    sound.startMusic(BGM, () => 96);
    state = 'aim';
  }

  function drop() {
    const p = makeBody(cur, aimX, spawnY(), aimAngle);
    Composite.add(engine.world, p.body);
    pieces.push(p);
    SFX.drop();
    state = 'fall';
    fallT = 0;
  }

  /** 탑의 최상단 y (작을수록 높다) */
  function towerTop() {
    let top = PLATE_Y;
    for (const p of pieces) {
      for (const part of p.body.parts) {
        if (part.bounds.min.y < top) top = part.bounds.min.y;
      }
    }
    return top;
  }

  function fallen(): Piece | null {
    for (const p of pieces) {
      if (p.body.position.y > KILL_Y) return p;
      if (p.body.position.x < -160 || p.body.position.x > W + 160) return p;
    }
    return null;
  }

  function settledNow() {
    for (const p of pieces) {
      if (p.body.isSleeping) continue;
      if (p.body.speed > 0.4 || Math.abs(p.body.angularSpeed) > 0.02) return false;
    }
    return true;
  }

  function gameOver(lostBy: 1 | 2 | 0) {
    SFX.crash();
    shake = 16;
    sound.stopMusic();
    state = 'over';
    overT = performance.now();
    if (mode === 'solo') {
      best = saveScore(KEY, score, CONFIG.grades);
      gradeJingle(gradeOf(CONFIG.grades, score).label);
    } else {
      winner = lostBy === 1 ? 2 : lostBy === 2 ? 1 : 0;
      gradeJingle('A');
    }
  }

  function nextTurn() {
    placed++;
    turn++;
    const h = Math.max(0, PLATE_Y - towerTop());
    if (mode === 'solo') {
      const gain = 100 + 50 * (cur.tier - 1) + Math.floor(h * 0.55);
      score += gain;
      toast = `+${gain}`;
      toastT = 1.1;
    } else {
      player = player === 1 ? 2 : 1;
    }
    SFX.place();
    cur = next;
    next = pickFood(turn + 1);
    aimAngle = 0;
    aimX = Math.max(46, Math.min(W - 46, aimX));
    turnLeft = CONFIG.turnTime;
    lastTickSec = 99;
    state = 'aim';
  }

  /* ===== 입력 ===== */
  const held = new Set<string>();
  let rotHeld = false, dragging = false;

  // 화면 아래 터치 버튼 (부스 태블릿용)
  const BTN_R = { x: W - 232, y: H - 56, w: 104, h: 42 };
  const BTN_D = { x: W - 118, y: H - 56, w: 104, h: 42 };
  const inBtn = (b: typeof BTN_R, x: number, y: number) =>
    x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

  function press() {
    sound.ensure();
    if (state === 'menu') { reset('solo'); return; }
    if (state === 'over') { if (performance.now() - overT > 700) toMenu(); return; }
    if (state === 'aim') drop();
  }

  const ac = new AbortController();
  const opts = { signal: ac.signal };

  window.addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    held.add(e.code);
    if (e.repeat) return;
    sound.ensure();
    if (state === 'menu') {
      if (e.code === 'Digit1' || e.code === 'Space' || e.code === 'Enter') reset('solo');
      if (e.code === 'Digit2') reset('duo');
    } else if (e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'Enter') {
      press();
    }
    if (e.code === 'KeyM') sound.toggleMute();
    if (e.code === 'KeyG') showCom = !showCom;
    if (e.code === 'KeyF') showFps = !showFps;
    if (e.code === 'KeyR' && state !== 'menu') toMenu();
  }, opts);
  window.addEventListener('keyup', e => held.delete(e.code), opts);
  window.addEventListener('blur', () => { held.clear(); rotHeld = false; dragging = false; }, opts);

  function localPos(e: PointerEvent) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) / (r.width / W), y: (e.clientY - r.top) / (r.height / H) };
  }

  cv.addEventListener('pointerdown', e => {
    const { x, y } = localPos(e);
    sound.ensure();
    if (state === 'menu') {
      // 메뉴는 좌/우 절반으로 모드 선택
      reset(x < W / 2 ? 'solo' : 'duo');
      return;
    }
    if (state === 'over') { press(); return; }
    if (state !== 'aim') return;
    if (inBtn(BTN_R, x, y)) { rotHeld = true; return; }
    if (inBtn(BTN_D, x, y)) { drop(); return; }
    dragging = true;
    aimX = Math.max(46, Math.min(W - 46, x));
  }, opts);

  cv.addEventListener('pointermove', e => {
    if (!dragging || state !== 'aim') return;
    const { x } = localPos(e);
    aimX = Math.max(46, Math.min(W - 46, x));
  }, opts);

  const endPointer = () => { dragging = false; rotHeld = false; };
  cv.addEventListener('pointerup', endPointer, opts);
  cv.addEventListener('pointercancel', endPointer, opts);
  cv.addEventListener('pointerleave', endPointer, opts);

  /* ===== 업데이트 ===== */
  let acc = 0;
  const STEP = 1000 / 60;

  function update(dt: number) {
    if (toastT > 0) toastT -= dt;
    if (shake > 0) shake = Math.max(0, shake - dt * 40);

    if (state === 'aim') {
      const prevX = aimX;
      if (held.has('ArrowLeft')) aimX -= CONFIG.moveSpeed * dt;
      if (held.has('ArrowRight')) aimX += CONFIG.moveSpeed * dt;
      aimX = Math.max(46, Math.min(W - 46, aimX));
      if (Math.abs(aimX - prevX) > 8) SFX.move();
      if (held.has('ArrowUp') || held.has('KeyZ') || rotHeld) {
        aimAngle += CONFIG.rotSpeed * dt;
        if (aimAngle > Math.PI * 2) aimAngle -= Math.PI * 2;
      }
      turnLeft -= dt;
      const sec = Math.ceil(turnLeft);
      if (sec <= 5 && sec !== lastTickSec) { lastTickSec = sec; SFX.tick(); }
      if (turnLeft <= 0) drop();
    }

    // 물리는 고정 스텝으로 — 프레임률이 흔들려도 결과가 흔들리지 않게
    acc += dt * 1000;
    if (acc > 120) acc = 120;   // 탭 전환 후 몰아서 계산하지 않도록
    while (acc >= STEP) {
      Engine.update(engine, STEP);
      acc -= STEP;
    }
    for (const p of pieces) p.t += dt;

    // 낙하 판정은 조준 중에도 해야 한다. 안착한 뒤에도 조각이 천천히 미끄러져
    // 접시를 벗어나는 일이 있는데, 'fall' 상태에서만 보면 다음 턴까지 눈치채지 못한다.
    if (state === 'aim' || state === 'fall') {
      const bad = fallen();
      if (bad) {
        // 떨어뜨린 사람이 패배. 혼자 모드는 그대로 종료
        gameOver(mode === 'duo' ? (bad.owner === 2 ? 2 : 1) : 0);
      } else if (state === 'fall') {
        fallT += dt;
        if (fallT > CONFIG.settleMin && (settledNow() || fallT > CONFIG.settleMax)) {
          SFX.land();
          nextTurn();
        }
      }
    }

    // 카메라 — 탑 상단을 화면 32% 지점에 두고 부드럽게 따라간다
    camTarget = Math.max(0, H * 0.42 - towerTop());
    camY += (camTarget - camY) * Math.min(1, dt * 4);
  }

  /* ===== 그리기 ===== */
  function drawPlate() {
    const x = W / 2, y = PLATE_Y;
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 22, CONFIG.plateW * 0.62, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, y - 6, 0, y + 20);
    g.addColorStop(0, '#dfe6f5');
    g.addColorStop(0.45, '#9aa6c4');
    g.addColorStop(1, '#4d5570');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x - CONFIG.plateW / 2, y, CONFIG.plateW, 18, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath();
    ctx.roundRect(x - CONFIG.plateW / 2 + 5, y + 2, CONFIG.plateW - 10, 3.5, 2);
    ctx.fill();
    // 굽 — 접시 폭에 비례
    const footW = CONFIG.plateW * 0.4;
    ctx.fillStyle = '#3a4058';
    ctx.beginPath();
    ctx.roundRect(x - footW / 2, y + 18, footW, 12, 3);
    ctx.fill();
  }

  function drawPiece(p: Piece) {
    ctx.save();
    ctx.translate(p.body.position.x, p.body.position.y);
    ctx.rotate(p.body.angle);
    ctx.translate(-p.off.x, -p.off.y);
    p.def.draw(ctx, p.t);
    ctx.restore();
  }

  function drawGhost() {
    const y = spawnY();
    // 낙하 안내선
    ctx.save();
    ctx.strokeStyle = 'rgba(0,255,200,.28)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.moveTo(aimX, y + 26);
    ctx.lineTo(aimX, PLATE_Y + 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.translate(aimX, y);
    ctx.rotate(aimAngle);
    cur.draw(ctx, performance.now() / 1000);
    ctx.restore();
  }

  /**
   * 무게중심 오버레이 (G키) — 이 게임의 수학을 눈으로 보여준다.
   * 조각별 무게중심과 탑 전체 무게중심을 찍고, 전체 무게중심이 접시의
   * 지지 구간 안에 있는지(= 토크가 상쇄되는지)를 색으로 표시한다.
   */
  function drawCom() {
    let mx = 0, my = 0, m = 0;
    for (const p of pieces) {
      const bm = p.body.mass;
      mx += p.body.position.x * bm;
      my += p.body.position.y * bm;
      m += bm;
      ctx.strokeStyle = 'rgba(255,215,0,.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.body.position.x, p.body.position.y, 4, 0, Math.PI * 2);
      ctx.moveTo(p.body.position.x - 7, p.body.position.y);
      ctx.lineTo(p.body.position.x + 7, p.body.position.y);
      ctx.moveTo(p.body.position.x, p.body.position.y - 7);
      ctx.lineTo(p.body.position.x, p.body.position.y + 7);
      ctx.stroke();
    }
    if (!m) return;
    const cx = mx / m, cy = my / m;
    const L = W / 2 - CONFIG.plateW / 2, R = W / 2 + CONFIG.plateW / 2;
    const stable = cx > L && cx < R;
    const col = stable ? '#00ffc8' : '#ff5f9e';

    // 지지 구간
    ctx.strokeStyle = col;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(L, PLATE_Y - 2);
    ctx.lineTo(R, PLATE_Y - 2);
    ctx.stroke();

    // 전체 무게중심에서 접시로 내리는 수직선 = 토크의 팔 길이
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, PLATE_Y - 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#05050c';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = col;
    ctx.font = 'bold 12px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(stable ? 'τ ≈ 0  안정' : 'τ ≠ 0  넘어간다', cx, cy - 14);
  }

  function btn(b: { x: number; y: number; w: number; h: number }, label: string, on: boolean) {
    ctx.fillStyle = on ? 'rgba(0,255,200,.18)' : 'rgba(16,16,32,.8)';
    ctx.strokeStyle = on ? '#00ffc8' : 'rgba(120,130,200,.3)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = on ? '#00ffc8' : '#cfd7f5';
    ctx.font = 'bold 15px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }

  function drawHud() {
    ctx.textAlign = 'left';
    if (mode === 'solo') {
      ctx.fillStyle = '#e8f0ff';
      ctx.font = 'bold 27px Consolas, monospace';
      ctx.fillText(String(score).padStart(5, '0'), 22, 42);
      ctx.fillStyle = '#556';
      ctx.font = '13px Consolas, monospace';
      ctx.fillText('BEST ' + String(best).padStart(5, '0'), 22, 63);
      ctx.fillStyle = '#8892a6';
      ctx.fillText(`쌓은 개수 ${placed}`, 22, 82);
    } else {
      const col = player === 1 ? '#00ffc8' : '#ff5f9e';
      ctx.fillStyle = col;
      ctx.font = 'bold 24px "Malgun Gothic", sans-serif';
      ctx.fillText(`${player}P 차례`, 22, 42);
      ctx.fillStyle = '#556';
      ctx.font = '13px Consolas, monospace';
      ctx.fillText(`총 ${placed}개 쌓임`, 22, 63);
    }

    // 제한시간 바
    if (state === 'aim') {
      const frac = Math.max(0, turnLeft / CONFIG.turnTime);
      const bw = 150;
      ctx.fillStyle = 'rgba(120,130,200,.18)';
      ctx.beginPath();
      ctx.roundRect(22, 94, bw, 6, 3);
      ctx.fill();
      ctx.fillStyle = frac < 0.25 ? '#ff5f9e' : '#00ffc8';
      ctx.beginPath();
      ctx.roundRect(22, 94, bw * frac, 6, 3);
      ctx.fill();
    }

    // 다음 음식 미리보기
    const px = W - 78, py = 66;
    ctx.fillStyle = 'rgba(16,16,32,.72)';
    ctx.strokeStyle = 'rgba(120,130,200,.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(px - 56, py - 46, 112, 96, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#4a5070';
    ctx.font = '11px "Malgun Gothic", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('다음', px, py - 30);
    ctx.save();
    ctx.translate(px, py - 2);
    const s = Math.min(1, 74 / Math.max(next.bbox.w, next.bbox.h));
    ctx.scale(s, s);
    next.draw(ctx, performance.now() / 1000);
    ctx.restore();
    ctx.fillStyle = '#cfd7f5';
    ctx.font = 'bold 13px "Malgun Gothic", sans-serif';
    ctx.fillText(next.name, px, py + 40);

    // 현재 음식 성격 안내 — 접시 위와 겹치지 않게 HUD 열에 붙인다
    if (state === 'aim') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#cfd7f5';
      ctx.font = 'bold 14px "Malgun Gothic", sans-serif';
      ctx.fillText(cur.name, 22, 124);
      ctx.fillStyle = 'rgba(176,154,255,.85)';
      ctx.font = '12px "Malgun Gothic", sans-serif';
      ctx.fillText(cur.desc, 22, 142);
    }

    // 터치 버튼 + 키 안내
    if (state === 'aim') {
      btn(BTN_R, '↻ 회전', rotHeld);
      btn(BTN_D, '↓ 놓기', false);
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = '#333a55';
    ctx.font = '11px Consolas, monospace';
    ctx.fillText('←→ 이동 · ↑ 회전 · SPACE 놓기 · G 무게중심 · R 메뉴 · M 소리', 22, H - 18);
    if (showFps) {
      ctx.textAlign = 'right';
      ctx.fillText(quality.fps.toFixed(0) + ' FPS · x' + quality.scale.toFixed(1), W - 22, H - 18);
    }

    if (toastT > 0 && mode === 'solo') {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, toastT * 1.6);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 30px Consolas, monospace';
      ctx.fillText(toast, W / 2, 150 - (1.1 - toastT) * 26);
      ctx.globalAlpha = 1;
    }
  }

  function drawMenu() {
    ctx.fillStyle = 'rgba(5,5,12,.9)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb03a';
    ctx.font = 'bold 44px "Malgun Gothic", sans-serif';
    ctx.fillText('K-푸드 타워', W / 2, 132);
    ctx.fillStyle = '#8892a6';
    ctx.font = '16px "Malgun Gothic", sans-serif';
    ctx.fillText('접시 위에 음식을 쌓아 올리세요. 떨어뜨리면 끝입니다.', W / 2, 166);
    ctx.fillStyle = '#5b6480';
    ctx.font = '13px "Malgun Gothic", sans-serif';
    ctx.fillText('중력만 작용합니다 — 무게중심을 지지점 위에 올리는 게 전부입니다', W / 2, 190);

    const cards: [string, string, string, string][] = [
      ['1', '혼자', '무너질 때까지 쌓기', '점수 · 등급이 나옵니다'],
      ['2', '둘이', '번갈아 쌓기', '먼저 떨어뜨린 쪽이 패배'],
    ];
    cards.forEach(([k, title, sub, note], i) => {
      const x = W / 2 + (i === 0 ? -152 : 152), y = 300;
      const col = i === 0 ? '#00ffc8' : '#ff5f9e';
      ctx.fillStyle = 'rgba(16,16,32,.85)';
      ctx.strokeStyle = col + '66';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(x - 128, y - 74, 256, 148, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.font = 'bold 30px "Malgun Gothic", sans-serif';
      ctx.fillText(title, x, y - 24);
      ctx.fillStyle = '#cfd7f5';
      ctx.font = '15px "Malgun Gothic", sans-serif';
      ctx.fillText(sub, x, y + 8);
      ctx.fillStyle = '#6b7490';
      ctx.font = '12px "Malgun Gothic", sans-serif';
      ctx.fillText(note, x, y + 32);
      ctx.fillStyle = col;
      ctx.font = 'bold 13px Consolas, monospace';
      ctx.fillText(`[ ${k} ]`, x, y + 60);
    });

    // 음식 목록 미리보기
    ctx.fillStyle = '#4a5070';
    ctx.font = '12px "Malgun Gothic", sans-serif';
    ctx.fillText(`음식 ${FOODS.length}종 — 모양이 곧 성격입니다`, W / 2, 424);
    const per = W / (FOODS.length + 1);
    FOODS.forEach((f, i) => {
      ctx.save();
      ctx.translate(per * (i + 1), 476);
      const s = Math.min(1, 52 / Math.max(f.bbox.w, f.bbox.h));
      ctx.scale(s, s);
      f.draw(ctx, performance.now() / 1000 + i);
      ctx.restore();
    });
    ctx.fillStyle = '#8892a6';
    ctx.font = '15px "Malgun Gothic", sans-serif';
    ctx.fillText('숫자키 또는 화면을 눌러 시작', W / 2, H - 46);
  }

  function drawOver() {
    ctx.fillStyle = 'rgba(10,10,18,.84)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    if (mode === 'solo') {
      const g = gradeOf(CONFIG.grades, score);
      ctx.fillStyle = '#e8f0ff';
      ctx.font = 'bold 28px Consolas, monospace';
      ctx.fillText('SCORE  ' + score, W / 2, H / 2 - 120);
      ctx.fillStyle = g.color;
      ctx.shadowColor = g.color;
      ctx.shadowBlur = 30;
      ctx.font = 'bold 130px "Segoe UI", sans-serif';
      ctx.fillText(g.label, W / 2, H / 2 + 10);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 26px "Malgun Gothic", sans-serif';
      ctx.fillText(g.msg, W / 2, H / 2 + 56);
      ctx.fillStyle = '#8892a6';
      ctx.font = '15px "Malgun Gothic", sans-serif';
      ctx.fillText(`${placed}개 쌓음 · 최고 ${best}점`, W / 2, H / 2 + 92);
    } else {
      const col = winner === 1 ? '#00ffc8' : '#ff5f9e';
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 30;
      ctx.font = 'bold 74px "Malgun Gothic", sans-serif';
      ctx.fillText(`${winner}P 승리!`, W / 2, H / 2 + 6);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#cfd7f5';
      ctx.font = '19px "Malgun Gothic", sans-serif';
      ctx.fillText(`${winner === 1 ? 2 : 1}P가 떨어뜨렸습니다`, W / 2, H / 2 + 50);
      ctx.fillStyle = '#8892a6';
      ctx.font = '15px "Malgun Gothic", sans-serif';
      ctx.fillText(`둘이서 ${placed}개까지 쌓았습니다`, W / 2, H / 2 + 84);
    }
    ctx.fillStyle = '#8892a6';
    ctx.font = '16px "Malgun Gothic", sans-serif';
    ctx.fillText('화면을 누르거나 SPACE — 다시', W / 2, H - 44);
  }

  function draw() {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // 배경
    ctx.fillStyle = '#08080f';
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      ctx.fillStyle = `rgba(200,215,255,${s.a})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    // 높이 눈금 — 카메라가 올라간 걸 체감하게
    ctx.strokeStyle = 'rgba(120,130,200,.10)';
    ctx.lineWidth = 1;
    const gridOff = camY % 60;
    for (let y = gridOff; y < H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    if (state !== 'menu') {
      ctx.save();
      ctx.translate(0, camY);
      drawPlate();
      for (const p of pieces) drawPiece(p);
      if (state === 'aim') drawGhost();
      if (showCom) drawCom();
      ctx.restore();
    }

    // 높이 표시
    const h = Math.max(0, PLATE_Y - towerTop());
    if (h > 4 && state !== 'menu') {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#4a5070';
      ctx.font = 'bold 14px Consolas, monospace';
      ctx.fillText(`높이 ${Math.round(h)}`, W - 22, H - 92);
    }

    if (state !== 'menu') drawHud();
    if (state === 'menu') drawMenu();
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
    Composite.clear(engine.world, false);
    Engine.clear(engine);
  };
}
