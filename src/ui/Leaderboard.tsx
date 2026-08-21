import { motion } from 'framer-motion';
import type { ScoreRecord } from '../lib/score';

interface Props {
  title: string;
  accent: string;
  records: ScoreRecord[];
  delay?: number;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ title, accent, records, delay = 0 }: Props) {
  return (
    <motion.div
      className="glass"
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: '1 1 340px', maxWidth: 470, padding: '20px 22px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ width: 7, height: 7, borderRadius: 99, background: accent, boxShadow: `0 0 12px ${accent}` }} />
        <h3 className="display" style={{ fontSize: 14, letterSpacing: '.16em', color: accent }}>
          {title}
        </h3>
      </div>

      {records.length === 0 ? (
        <p style={{ color: 'var(--faint)', fontSize: 13, padding: '18px 2px' }}>아직 기록이 없습니다</p>
      ) : (
        <ol style={{ listStyle: 'none', display: 'grid', gap: 2 }}>
          {records.slice(0, 10).map((r, i) => (
            <motion.li
              key={`${r.ts}-${i}`}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.05 + i * 0.03 }}
              style={{
                display: 'grid',
                gridTemplateColumns: '30px 30px 1fr',
                alignItems: 'center',
                gap: 10,
                padding: '8px 8px',
                borderRadius: 8,
                background: i === 0 ? `${accent}12` : 'transparent',
                borderBottom: '1px solid rgba(255,255,255,.04)',
              }}
            >
              <span className="mono" style={{ fontSize: 13, color: 'var(--faint)' }}>
                {MEDAL[i] ?? i + 1}
              </span>
              <span className={`display g-${r.grade}`} style={{ fontSize: 15, fontWeight: 900, textAlign: 'center' }}>
                {r.grade}
              </span>
              <span className="mono" style={{ fontSize: 16, textAlign: 'right', color: '#dbe3ff' }}>
                {r.score.toLocaleString()}
              </span>
            </motion.li>
          ))}
        </ol>
      )}
    </motion.div>
  );
}
