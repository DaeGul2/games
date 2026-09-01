import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

/** 게임별 팔레트 — global.css 의 --g-* 토큰과 같은 값 */
export interface GamePalette {
  accent: string;
  border: string;
  title: string;
  btn: string;
  label: string;
}

export interface GameCardProps {
  to: string;
  title: string;
  tagline: string;
  bullets: string[];
  controls: string;
  palette: GamePalette;
  index: number;
  art: React.ReactNode;
}

/** 흰 카드 + 파스텔 픽셀 보더 + 단차 그림자. hover 는 살짝 떠오르기만 */
export default function GameCard({ to, title, tagline, bullets, controls, palette, index, art }: GameCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 + index * 0.09, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: '1 1 380px', maxWidth: 470 }}
    >
      <Link to={to} style={{ display: 'block' }}>
        <motion.div
          whileHover={{ y: -3, boxShadow: `0 9px 0 ${palette.border}` }}
          whileTap={{ y: 2, boxShadow: `0 3px 0 ${palette.border}` }}
          style={{
            position: 'relative',
            borderRadius: 18,
            border: `3px solid ${palette.border}`,
            background: '#fff',
            boxShadow: `0 6px 0 ${palette.border}`,
            padding: 24,
            minHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div
                className="display"
                style={{
                  display: 'inline-block',
                  fontSize: 11,
                  letterSpacing: '.16em',
                  color: '#fff',
                  background: palette.label,
                  borderRadius: 6,
                  padding: '3px 9px',
                  marginBottom: 10,
                }}
              >
                GAME 0{index + 1}
              </div>
              <h2 className="display" style={{ fontSize: 30, color: palette.title, lineHeight: 1.1 }}>
                {title}
              </h2>
              <p style={{ color: '#6e6f82', fontSize: 14, marginTop: 6 }}>{tagline}</p>
            </div>
            <div style={{ flexShrink: 0, display: 'grid', justifyItems: 'end', gap: 6 }}>
              <div className="hearts" aria-hidden>
                <img src="/deco/heart-pink.png" alt="" className="pixel" />
                <img src="/deco/heart-pink.png" alt="" className="pixel" />
                <img src="/deco/heart-pink.png" alt="" className="pixel" style={{ opacity: 0.35 }} />
              </div>
              {art}
            </div>
          </div>

          <ul style={{ listStyle: 'none', display: 'grid', gap: 7, marginTop: 2 }}>
            {bullets.map(b => (
              <li key={b} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 14, color: '#4e5060' }}>
                <span style={{ color: palette.accent, lineHeight: 1.4 }}>▸</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: '#fff',
                background: palette.label,
                borderRadius: 6,
                padding: '4px 9px',
                letterSpacing: '.06em',
              }}
            >
              {controls}
            </div>
            <span className="btn-solid display" style={{ background: palette.btn }}>
              PLAY ▶
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
