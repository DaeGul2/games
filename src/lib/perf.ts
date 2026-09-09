/**
 * 적응형 화질 + 반응형 캔버스.
 *
 * 화질: 부스 PC/폰 사양을 알 수 없으므로 실측 FPS에 맞춰 스스로 낮춘다.
 *  1단계: 렌더 해상도 배율을 1로 (픽셀 수 최대 4배 감소)
 *  2단계: low 플래그를 올려 파티클·잔상 등 부가 효과를 줄임
 * 회복도 하므로 일시적인 끊김으로 영구히 저화질이 되지 않는다.
 *
 * 크기: 캔버스의 표시 크기는 CSS(.stage canvas)가 정한다. 여기서는 실제로 표시된
 * 크기를 관찰해 백버퍼 해상도만 맞춘다. 그래서 화면 회전·주소창 접힘·창 크기 변경에
 * 전부 따라간다. 게임 코드는 항상 논리 좌표 W x H 로만 그리면 된다.
 */
export class Quality {
  /** 논리 좌표 1당 실제 픽셀 수 (표시 배율 x DPR) */
  scale = 1;
  low = false;
  fps = 60;

  private dprCap: number;
  private ro?: ResizeObserver;
  private acc = 0;
  private frames = 0;
  private cooldown = 1.5;   // 시작 직후·변경 직후에는 판단하지 않음
  private goodStreak = 0;

  constructor(
    private cv: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private w: number,
    private h: number,
  ) {
    this.dprCap = Math.min(window.devicePixelRatio || 1, 2);
    // CSS가 이 두 값으로 폭·비율을 계산한다 (global.css 의 .stage canvas)
    cv.style.setProperty('--gw', String(w));
    cv.style.setProperty('--gh', String(h));
    this.apply();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.apply());
      this.ro.observe(cv);
    }
  }

  /** 표시 크기 x 배율로 백버퍼를 다시 잡는다. 크기를 바꾸면 컨텍스트 상태가 초기화되므로 변환을 다시 건다. */
  private apply() {
    // clientWidth 는 레이아웃 크기 — 무대 등장 애니메이션(transform: scale)에 흔들리지 않는다
    const cssW = this.cv.clientWidth || this.cv.getBoundingClientRect().width || this.w;
    const k = Math.max(0.25, cssW / this.w) * this.dprCap * (this.lowRes ? 0.5 : 1);
    const pw = Math.max(1, Math.round(this.w * k));
    const ph = Math.max(1, Math.round(this.h * k));
    if (pw === this.cv.width && ph === this.cv.height) return;
    this.cv.width = pw;
    this.cv.height = ph;
    this.scale = pw / this.w;
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  private lowRes = false;

  /** 매 프레임 호출 */
  tick(dt: number) {
    this.frames++;
    this.acc += dt;
    if (this.cooldown > 0) {
      this.cooldown -= dt;
      if (this.acc >= 1) { this.acc = 0; this.frames = 0; }
      return;
    }
    if (this.acc < 1) return;

    this.fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;

    if (this.fps < 52 && !this.lowRes) {
      this.lowRes = true;
      this.apply();
      this.cooldown = 2;
      this.goodStreak = 0;
    } else if (this.fps < 45 && !this.low) {
      this.low = true;
      this.cooldown = 2;
      this.goodStreak = 0;
    } else if (this.fps > 58) {
      // 충분히 여유로운 상태가 이어지면 한 단계 되돌린다
      if (++this.goodStreak >= 8 && (this.low || this.lowRes)) {
        if (this.low) this.low = false;
        else { this.lowRes = false; this.apply(); }
        this.goodStreak = 0;
        this.cooldown = 3;
      }
    } else {
      this.goodStreak = 0;
    }
  }

  dispose() {
    this.ro?.disconnect();
  }
}
