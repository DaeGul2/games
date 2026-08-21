import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

interface Props {
  title: string;
  accent: string;
  hints: { key: string; label: string }[];
  /** 캔버스를 받아 게임 루프를 시작하고, 정리 함수를 반환 */
  mount: (cv: HTMLCanvasElement) => () => void;
}

export default function GameShell({ title, accent, hints, mount }: Props) {
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
        padding: '24px 16px',
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
        <Link to="/">
          <motion.div
            whileHover={{ x: -4, borderColor: `${accent}88`, color: accent }}
            className="display"
            style={{
              fontSize: 12,
              letterSpacing: '.14em',
              color: 'var(--faint)',
              border: '1px solid rgba(120,130,200,.2)',
              borderRadius: 9,
              padding: '9px 16px',
            }}
          >
            ← MENU
          </motion.div>
        </Link>

        <h1
          className="display"
          style={{ fontSize: 17, letterSpacing: '.18em', color: accent, textShadow: `0 0 22px ${accent}55` }}
        >
          {title}
        </h1>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {hints.map(h => (
            <div
              key={h.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 11,
                color: 'var(--dim)',
                border: '1px solid rgba(120,130,200,.16)',
                borderRadius: 8,
                padding: '6px 10px',
                background: 'rgba(16,16,32,.5)',
              }}
            >
              <kbd
                className="mono"
                style={{
                  background: 'rgba(120,130,200,.14)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  fontSize: 10,
                  color: '#cfd7f5',
                }}
              >
                {h.key}
              </kbd>
              {h.label}
            </div>
          ))}
        </div>
      </div>

      {/* 캔버스 무대 */}
      <motion.div
        className="stage"
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{ color: accent, boxShadow: `0 0 80px -30px ${accent}` }}
      >
        <canvas ref={ref} />
      </motion.div>

      <p className="mono" style={{ fontSize: 11, color: '#333a55' }}>
        게임 종료 시 등급이 화면에 표시됩니다 · 직원에게 보여주고 포인트를 받으세요
      </p>
    </div>
  );
}
