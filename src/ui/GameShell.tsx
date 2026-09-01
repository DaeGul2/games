import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { T } from '../i18n';
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

  useEffect(() => {
    if (!ref.current) return;
    return mount(ref.current); // 언마운트 시 리스너·RAF·BGM 정리
  }, [mount]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '84px 16px 48px',
        gap: 18,
      }}
    >
      {/* 상단 바 */}
      <div
        style={{
          width: '100%',
          maxWidth: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <Link to="/" className="btn-menu display">
          ← MENU
        </Link>

        <h1 className="display" style={{ fontSize: 24, color: palette.title }}>
          {title}
        </h1>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hints.map(h => (
            <div key={h.key} className="chip">
              <kbd>{h.key}</kbd>
              {h.label}
            </div>
          ))}
        </div>
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
      <div className="deco-fixed" style={{ left: 28, bottom: 30, display: 'grid', justifyItems: 'start', gap: 6 }}>
        <motion.div
          className="bubble"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{ marginLeft: 40 }}
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
      <div className="deco-fixed" style={{ right: 36, bottom: 26, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
        <img src="/deco/plant-tulip.png" alt="" className="pixel" style={{ height: 48 }} />
        <img src="/deco/heart-pink.png" alt="" className="pixel" style={{ height: 22, marginBottom: 40 }} />
        <img src="/deco/plant-pink.png" alt="" className="pixel" style={{ height: 44 }} />
      </div>
    </div>
  );
}
