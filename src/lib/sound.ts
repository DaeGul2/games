/**
 * 사운드 엔진 — Web Audio 실시간 합성 (외부 음원 파일 없음 → 저작권 무관)
 * - tone/noise: 효과음 프리미티브
 * - startMusic: 16스텝 시퀀서 BGM (킥/하이햇/베이스/리드), 룩어헤드 스케줄링
 */

export interface ToneOpts {
  f?: number;
  f2?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
  when?: number;
  dest?: AudioNode | null;
}

export interface NoiseOpts {
  dur?: number;
  vol?: number;
  fc?: number;
  type?: BiquadFilterType;
  when?: number;
  dest?: AudioNode | null;
}

export interface Pattern {
  kick: number[];
  hat: number[];
  bass: number[];
  lead: number[];
}

class SoundEngine {
  private ac: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private _muted = false;
  private seqTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextT = 0;
  private pattern: Pattern | null = null;
  private getBpm: () => number = () => 120;
  private noiseBuf: AudioBuffer | null = null;

  get muted() { return this._muted; }

  private init() {
    if (this.ac) return;
    this.ac = new AudioContext();
    this.master = this.ac.createGain();
    this.master.gain.value = this._muted ? 0 : 0.5;
    this.master.connect(this.ac.destination);
    this.musicG = this.ac.createGain();
    this.musicG.gain.value = 0.32;
    this.musicG.connect(this.master);
    this.sfxG = this.ac.createGain();
    this.sfxG.gain.value = 0.6;
    this.sfxG.connect(this.master);
  }

  /** 브라우저 정책상 사용자 입력 핸들러 안에서 호출해야 오디오가 시작됨 */
  ensure() {
    this.init();
    if (this.ac!.state === 'suspended') this.ac!.resume();
  }

  /** 단일 오실레이터 + 엔벨로프 (f→f2 피치 슬라이드) */
  tone({ f = 440, f2 = 0, dur = 0.1, type = 'square', vol = 0.3, when = 0, dest = null }: ToneOpts) {
    const ac = this.ac;
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** 화이트노이즈 + 필터 (타격·폭발·하이햇) */
  noise({ dur = 0.2, vol = 0.3, fc = 1000, type = 'lowpass', when = 0, dest = null }: NoiseOpts) {
    const ac = this.ac;
    if (!ac) return;
    if (!this.noiseBuf) {
      this.noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ac.currentTime + when;
    const s = ac.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const fl = ac.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = fc;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(dest ?? this.sfxG);
    s.start(t, Math.random());
    s.stop(t + dur + 0.02);
  }

  private schedStep(t: number, i: number, sd: number) {
    const ac = this.ac!;
    const p = this.pattern!;
    const when = t - ac.currentTime;
    if (p.kick[i % 16]) {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g);
      g.connect(this.musicG);
      o.start(t);
      o.stop(t + 0.15);
    }
    if (p.hat[i % 16]) this.noise({ dur: 0.03, vol: 0.1, fc: 7000, type: 'highpass', when, dest: this.musicG });
    const b = p.bass[i % p.bass.length];
    if (b) this.tone({ f: b, dur: sd * 0.95, type: 'triangle', vol: 0.3, when, dest: this.musicG });
    const l = p.lead[i % p.lead.length];
    if (l) this.tone({ f: l, dur: sd * 0.85, type: 'square', vol: 0.08, when, dest: this.musicG });
  }

  /** BGM 시작. 이미 재생 중이면 패턴/템포만 교체 (보스전 전환 등) */
  startMusic(pat: Pattern, bpmFn?: () => number) {
    this.ensure();
    this.pattern = pat;
    if (bpmFn) this.getBpm = bpmFn;
    if (this.seqTimer) return;
    this.step = 0;
    this.nextT = this.ac!.currentTime + 0.05;
    this.seqTimer = setInterval(() => {
      const sd = 60 / this.getBpm() / 4; // 16분음표 길이
      while (this.nextT < this.ac!.currentTime + 0.12) {
        this.schedStep(this.nextT, this.step, sd);
        this.nextT += sd;
        this.step++;
      }
    }, 30);
  }

  stopMusic() {
    if (this.seqTimer) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
    this.pattern = null;
  }

  toggleMute() {
    this._muted = !this._muted;
    if (this.ac) this.master.gain.value = this._muted ? 0 : 0.5;
    return this._muted;
  }
}

/** 앱 전역 싱글턴 */
export const sound = new SoundEngine();
