import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

export interface GameCardProps {
  to: string;
  title: string;
  tagline: string;
  bullets: string[];
  controls: string;
  accent: string;
  index: number;
  art: React.ReactNode;
}

/** 마우스 위치를 따라 기울어지는 3D 카드 (스프링 감쇠 + 글레어) */
export default function GameCard({ to, title, tagline, bullets, controls, accent, index, art }: GameCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 220, damping: 22 });
  const sy = useSpring(my, { stiffness: 220, damping: 22 });
  const rotateY = useTransform(sx, [0, 1], [-9, 9]);
  const rotateX = useTransform(sy, [0, 1], [7, -7]);
  const glareX = useTransform(sx, [0, 1], ['0%', '100%']);
  const glareY = useTransform(sy, [0, 1], ['0%', '100%']);

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    mx.set((e.clientX - r.left) / r.width);
    my.set((e.clientY - r.top) / r.height);
  }
  function onLeave() {
    mx.set(0.5);
    my.set(0.5);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 34 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16 + index * 0.11, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{ perspective: 1100, flex: '1 1 380px', maxWidth: 470 }}
    >
      <Link to={to} style={{ display: 'block' }}>
        <motion.div
          ref={ref}
          onMouseMove={onMove}
          onMouseLeave={onLeave}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.985 }}
          style={{
            rotateX,
            rotateY,
            transformStyle: 'preserve-3d',
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 20,
            border: `1px solid ${accent}33`,
            background: `linear-gradient(160deg, ${accent}14, rgba(12,12,26,.86) 42%)`,
            boxShadow: `0 20px 60px -28px ${accent}80`,
            padding: 26,
            minHeight: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* 마우스를 따라오는 글레어 */}
          <motion.div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: useTransform(
                [glareX, glareY],
                ([x, y]) => `radial-gradient(420px circle at ${x} ${y}, ${accent}22, transparent 62%)`,
              ),
            }}
          />

          {/* 상단 아트 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div
                className="display"
                style={{ fontSize: 12, letterSpacing: '.22em', color: accent, opacity: 0.85, marginBottom: 8 }}
              >
                GAME 0{index + 1}
              </div>
              <h2 className="display" style={{ fontSize: 30, color: accent, textShadow: `0 0 26px ${accent}66` }}>
                {title}
              </h2>
              <p style={{ color: 'var(--dim)', fontSize: 14, marginTop: 6 }}>{tagline}</p>
            </div>
            <div style={{ flexShrink: 0, opacity: 0.95 }}>{art}</div>
          </div>

          <ul style={{ listStyle: 'none', display: 'grid', gap: 8, marginTop: 2 }}>
            {bullets.map(b => (
              <li key={b} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 14, color: '#c3cbe8' }}>
                <span style={{ color: accent, lineHeight: 1.35 }}>▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div className="mono" style={{ fontSize: 12, color: 'var(--faint)' }}>
              {controls}
            </div>
            <motion.div
              className="display"
              whileHover={{ x: 4 }}
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: '#05050c',
                background: accent,
                padding: '10px 18px',
                borderRadius: 10,
                boxShadow: `0 0 24px ${accent}55`,
                whiteSpace: 'nowrap',
              }}
            >
              PLAY ▶
            </motion.div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
