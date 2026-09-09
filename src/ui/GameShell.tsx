import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { T } from '../i18n';
import { sound } from '../lib/sound';
import type { GamePalette } from './GameCard';

interface Props {
  title: string;
  /** 캐릭터 말풍선에 들어갈 한 줄 (게임 부제) */
  tagline: string;
  palette: GamePalette;
  hints: { key: string; label: string }[];
  /** 캔버스를 받아 게임 루프를 시작하고, 정리 함수를 반환 */
  mount: (cv: HTMLCanvasElement) => () => void;
}

export default function GameShell({ title, tagline, palette, hints, mount }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [muted, setMuted] = useState(sound.muted);

  useEffect(() => {
    if (!ref.current) return;
    return mount(ref.current); // 언마운트 시 리스너·RAF·BGM 정리
  }, [mount]);

  return (
    <div className="game-shell">
      {/* 상단 바 */}
      <div className="game-bar">
        <Link to="/" className="btn-menu display">
          ← MENU
        </Link>

        <h1 className="display" style={{ color: palette.title }}>
          {title}
        </h1>

        {/* 키보드 힌트 — 터치 기기에서는 CSS가 숨긴다 */}
        <div className="game-hints">
          {hints.map(h => (
            <div key={h.key} className="chip">
              <kbd>{h.key}</kbd>
              {h.label}
            </div>
          ))}
        </div>

        {/* 터치 기기에는 M 키가 없으므로 음소거 버튼을 준다 */}
        <button
          type="button"
          className="btn-icon touch-only"
          onClick={() => setMuted(sound.toggleMute())}
          aria-pressed={muted}
        >
          {muted ? '🔇' : '🔊'} {T.common.mute}
        </button>
      </div>

      {/* 캔버스 무대 — 흰 프레임, 보더 색은 게임 색 */}
      <motion.div
        className="stage"
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        style={{ color: palette.border }}
      >
        <canvas ref={ref} />
      </motion.div>

      <p className="notice">{T.common.shellNote}</p>

      {/* 왼쪽 아래 — 안내 캐릭터 + 말풍선 (시안 2안) */}
      {/* 인라인 display 를 쓰면 모바일에서 숨기는 미디어쿼리를 이겨 버린다 — 배치도 CSS로 */}
      <div className="deco-fixed deco-kid">
        <motion.div
          className="bubble"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          {tagline}
        </motion.div>
        <motion.img
          src="/deco/kid.png"
          alt=""
          className="pixel"
          style={{ height: 150, width: 'auto' }}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* 오른쪽 아래 — 꽃 */}
      <div className="deco-fixed deco-flowers">
        <img src="/deco/plant-tulip.png" alt="" className="pixel" style={{ height: 48 }} />
        <img src="/deco/heart-pink.png" alt="" className="pixel" style={{ height: 22, marginBottom: 40 }} />
        <img src="/deco/plant-pink.png" alt="" className="pixel" style={{ height: 44 }} />
      </div>
    </div>
  );
}
