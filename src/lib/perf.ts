/**
 * 적응형 화질 — 부스 PC 사양을 알 수 없으므로 실측 FPS에 맞춰 스스로 낮춘다.
 *  1단계: 렌더 해상도 배율을 1로 (픽셀 수 최대 4배 감소)
 *  2단계: low 플래그를 올려 파티클·잔상 등 부가 효과를 줄임
 * 회복도 하므로 일시적인 끊김으로 영구히 저화질이 되지 않는다.
 */
export class Quality {
  scale: number;
  low = false;
  fps = 60;

  private acc = 0;
  private frames = 0;
  private cooldown = 1.5;   // 시작 직후·변경 직후에는 판단하지 않음
  private goodStreak = 0;

  constructor(
    private cv: HTMLCanvasElement,
    private ctx: CanvasRenderingContext2D,
    private w: number,
    private h: number,
    private cssScale = 1,
  ) {
    this.scale = Math.min(window.devicePixelRatio || 1, 2);
    this.apply();
  }

  /** 렌더 해상도 반영. 캔버스 크기를 바꾸면 컨텍스트 상태가 초기화되므로 변환을 다시 건다. */
  private apply() {
    this.cv.width = Math.round(this.w * this.scale);
    this.cv.height = Math.round(this.h * this.scale);
    this.cv.style.width = this.w * this.cssScale + 'px';
    this.cv.style.height = this.h * this.cssScale + 'px';
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

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

    if (this.fps < 52 && this.scale > 1) {
      this.scale = 1;
      this.apply();
      this.cooldown = 2;
      this.goodStreak = 0;
    } else if (this.fps < 45 && !this.low) {
      this.low = true;
      this.cooldown = 2;
      this.goodStreak = 0;
    } else if (this.fps > 58) {
      // 충분히 여유로운 상태가 이어지면 한 단계 되돌린다
      if (++this.goodStreak >= 8 && this.low) {
        this.low = false;
        this.goodStreak = 0;
        this.cooldown = 3;
      }
    } else {
      this.goodStreak = 0;
    }
  }
}
