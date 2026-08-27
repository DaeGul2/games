/**
 * K-푸드 사격 — 캐릭터 그리기
 *
 * 라스트 워 계열의 **키 작은 3등신** 인물. 원근으로 아주 작게도 그려지므로
 * 머리를 크게, 실루엣을 뭉툭하게 잡는다. 디테일은 전부 명암(밝은 면 / 어두운 면)으로 낸다 —
 * 선을 많이 긋는 것보다 면을 두 톤으로 나누는 쪽이 작게 그려도 형태가 살아남는다.
 *
 * 모든 함수는 (0,0)이 **발끝**인 로컬 좌표계에 그리고, s로 크기를 조절한다.
 * 기본 크기(s=1)일 때 키는 약 46px.
 */

type Ctx = CanvasRenderingContext2D;

/** 색을 어둡게/밝게 — 명암을 손으로 두 벌 적지 않기 위해 */
function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * k));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * k));
  const b = Math.min(255, Math.max(0, (n & 255) * k));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export interface Palette {
  /** 옷 */
  cloth: string;
  /** 바지 */
  pants: string;
  /** 피부 */
  skin: string;
  /** 머리카락 */
  hair: string;
  /** 모자 (없으면 머리카락만) */
  hat?: string;
}

export const PAL = {
  chef: { cloth: '#f3f6fb', pants: '#2b3550', skin: '#f5d0b0', hair: '#3a2a22', hat: '#ffffff' } as Palette,
  grunt: { cloth: '#d63a3a', pants: '#3a1a1a', skin: '#f0c9a6', hair: '#2a1a14', hat: '#8f1f1f' } as Palette,
  runner: { cloth: '#ff6b3d', pants: '#4a1f10', skin: '#f0c9a6', hair: '#2a1a14' } as Palette,
  tank: { cloth: '#7a2e2e', pants: '#2b1212', skin: '#e8bf9c', hair: '#1d1310', hat: '#4a1a1a' } as Palette,
  boss: { cloth: '#b31b1b', pants: '#2a0c0c', skin: '#e8bf9c', hair: '#1a0f0c', hat: '#5c0d0d' } as Palette,
};

/**
 * 인물 하나.
 * @param phase 걷기 위상 (라디안). 0이면 차렷.
 * @param facing 1이면 화면 안쪽(등 보임), -1이면 화면 밖(정면)
 */
export function drawPerson(c: Ctx, s: number, p: Palette, phase: number, facing: 1 | -1 = 1, bulk = 1) {
  const swing = Math.sin(phase);
  const bob = Math.abs(Math.cos(phase)) * 1.2 * s;
  const L = shade(p.cloth, 1.0), Ld = shade(p.cloth, 0.62);
  const P = p.pants, Pd = shade(p.pants, 0.6);
  const K = p.skin, Kd = shade(p.skin, 0.72);

  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';

  /* 그림자 */
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.beginPath();
  c.ellipse(0, 0, 11 * s * bulk, 3.6 * s, 0, 0, Math.PI * 2);
  c.fill();

  c.translate(0, -bob);

  /* 다리 — 뒤 다리가 어둡다 */
  const legW = 4.6 * s * bulk;
  for (const side of [-1, 1]) {
    const back = side * swing < 0;
    const kx = side * 3.6 * s * bulk;
    const fx = kx + side * 0 + swing * side * 4.2 * s;
    c.strokeStyle = back ? Pd : P;
    c.lineWidth = legW;
    c.beginPath();
    c.moveTo(kx, -14 * s);
    c.lineTo(fx, -1.5 * s);
    c.stroke();
    // 신발
    c.fillStyle = back ? '#1a1a22' : '#2a2a36';
    c.beginPath();
    c.ellipse(fx + side * 0.6 * s, -0.8 * s, 3.4 * s, 1.9 * s, 0, 0, Math.PI * 2);
    c.fill();
  }

  /* 몸통 — 왼쪽 밝고 오른쪽 어둡게 */
  const bw = 8.4 * s * bulk, bh = 15 * s;
  c.fillStyle = Ld;
  c.beginPath();
  c.roundRect(-bw, -28 * s, bw * 2, bh, 3.4 * s);
  c.fill();
  c.fillStyle = L;
  c.beginPath();
  c.roundRect(-bw, -28 * s, bw * 1.15, bh, 3.4 * s);
  c.fill();
  // 허리띠
  c.fillStyle = shade(p.pants, 0.8);
  c.fillRect(-bw, -14.5 * s, bw * 2, 2.2 * s);
  // 옷 앞섶 선 (등을 보이면 척추선)
  c.strokeStyle = 'rgba(0,0,0,.18)';
  c.lineWidth = 1 * s;
  c.beginPath();
  c.moveTo(0, -27 * s);
  c.lineTo(0, -15 * s);
  c.stroke();

  /* 팔 — 걷기에 맞춰 반대로 흔든다 */
  for (const side of [-1, 1]) {
    const back = side * swing > 0;
    const ax = side * (bw + 1.2 * s);
    const hx = ax + side * 1.5 * s - swing * side * 3.5 * s;
    c.strokeStyle = back ? Ld : L;
    c.lineWidth = 3.8 * s * bulk;
    c.beginPath();
    c.moveTo(ax, -25 * s);
    c.lineTo(hx, -15 * s);
    c.stroke();
    // 손
    c.fillStyle = back ? Kd : K;
    c.beginPath();
    c.arc(hx, -14 * s, 2.2 * s * bulk, 0, Math.PI * 2);
    c.fill();
  }

  /* 목 */
  c.fillStyle = Kd;
  c.fillRect(-2.2 * s, -31 * s, 4.4 * s, 4 * s);

  /* 머리 — 크게. 아래쪽에 그늘 */
  const hr = 8.6 * s;
  const hy = -37 * s;
  c.fillStyle = K;
  c.beginPath();
  c.arc(0, hy, hr, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(0,0,0,.14)';
  c.beginPath();
  c.arc(0, hy + hr * 0.55, hr * 0.8, 0, Math.PI);
  c.fill();
  // 귀
  c.fillStyle = Kd;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.ellipse(side * hr * 0.98, hy + 0.5 * s, 1.9 * s, 2.6 * s, 0, 0, Math.PI * 2);
    c.fill();
  }

  if (facing === 1) {
    /* 등을 보임 — 뒷머리 */
    c.fillStyle = p.hair;
    c.beginPath();
    c.arc(0, hy - 0.8 * s, hr * 1.02, Math.PI * 1.0, Math.PI * 2.0);
    c.lineTo(hr * 1.02, hy + hr * 0.45);
    c.quadraticCurveTo(0, hy + hr * 0.62, -hr * 1.02, hy + hr * 0.45);
    c.closePath();
    c.fill();
  } else {
    /* 정면 — 앞머리 + 눈 */
    c.fillStyle = p.hair;
    c.beginPath();
    c.arc(0, hy - 0.8 * s, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98);
    c.lineTo(hr * 0.9, hy - hr * 0.15);
    c.quadraticCurveTo(hr * 0.3, hy - hr * 0.5, -hr * 0.2, hy - hr * 0.3);
    c.quadraticCurveTo(-hr * 0.7, hy - hr * 0.1, -hr * 0.9, hy - hr * 0.15);
    c.closePath();
    c.fill();
    c.fillStyle = '#1a1214';
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(side * 3 * s, hy + 1.2 * s, 1.3 * s, 1.9 * s, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.7)';
    for (const side of [-1, 1]) {
      c.beginPath();
      c.arc(side * 3 * s - 0.4 * s, hy + 0.5 * s, 0.5 * s, 0, Math.PI * 2);
      c.fill();
    }
  }

  /* 모자 */
  if (p.hat) {
    const H = p.hat, Hd = shade(p.hat, 0.7);
    if (p === PAL.chef) {
      // 요리사 모자 — 띠 + 부풀어 오른 윗부분
      c.fillStyle = Hd;
      c.beginPath();
      c.roundRect(-hr * 1.05, hy - hr * 0.95, hr * 2.1, 4.2 * s, 1.5 * s);
      c.fill();
      c.fillStyle = H;
      c.beginPath();
      c.roundRect(-hr * 1.05, hy - hr * 0.95, hr * 1.3, 4.2 * s, 1.5 * s);
      c.fill();
      c.fillStyle = H;
      c.beginPath();
      c.ellipse(0, hy - hr * 1.25, hr * 1.08, hr * 0.62, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = Hd;
      c.beginPath();
      c.ellipse(hr * 0.35, hy - hr * 1.2, hr * 0.62, hr * 0.5, 0.2, 0, Math.PI);
      c.fill();
    } else {
      // 악당 — 챙 모자/투구
      c.fillStyle = Hd;
      c.beginPath();
      c.ellipse(0, hy - hr * 0.72, hr * 1.22, hr * 0.32, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = H;
      c.beginPath();
      c.arc(0, hy - hr * 0.72, hr * 0.98, Math.PI, Math.PI * 2);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.14)';
      c.beginPath();
      c.arc(-hr * 0.3, hy - hr * 0.95, hr * 0.42, Math.PI * 1.1, Math.PI * 1.9);
      c.fill();
    }
  }

  c.restore();
}

/** 젓가락 한 쌍을 든 손 — 플레이어 전용 (등을 보이는 자세 기준) */
export function drawChopsticksHeld(c: Ctx, s: number, t: number) {
  c.save();
  c.lineCap = 'round';
  const kick = Math.max(0, Math.sin(t * 40)) * 1.4 * s;
  c.strokeStyle = '#e8d3a2';
  c.lineWidth = 2.6 * s;
  c.beginPath();
  c.moveTo(-10 * s, -18 * s);
  c.lineTo(-13 * s, -44 * s - kick);
  c.moveTo(10 * s, -18 * s);
  c.lineTo(13 * s, -44 * s - kick);
  c.stroke();
  c.strokeStyle = '#8d7548';
  c.lineWidth = 1 * s;
  c.beginPath();
  c.moveTo(-10 * s, -18 * s);
  c.lineTo(-13 * s, -44 * s - kick);
  c.moveTo(10 * s, -18 * s);
  c.lineTo(13 * s, -44 * s - kick);
  c.stroke();
  c.restore();
}
