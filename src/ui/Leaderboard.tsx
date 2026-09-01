import { motion } from 'framer-motion';
import type { ScoreRecord } from '../lib/score';
import { T } from '../i18n';
import type { GamePalette } from './GameCard';

interface Props {
  title: string;
  palette: GamePalette;
  records: ScoreRecord[];
  delay?: number;
}

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard({ title, palette, records, delay = 0 }: Props) {
  return (
    <motion.div
      className="panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: '1 1 340px', maxWidth: 470, padding: '18px 20px', borderColor: palette.border }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ width: 8, height: 8, background: palette.accent }} />
        <h3 className="display" style={{ fontSize: 15, color: palette.title }}>
          {title}
        </h3>
      </div>

      {records.length === 0 ? (
        <p style={{ color: 'var(--faint)', fontSize: 13, padding: '16px 2px' }}>{T.common.noRecords}</p>
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
                padding: '7px 8px',
                borderRadius: 8,
                background: i === 0 ? `${palette.border}55` : 'transparent',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              <span className="mono" style={{ fontSize: 13, color: 'var(--faint)' }}>
                {MEDAL[i] ?? i + 1}
              </span>
              <span className={`display g-${r.grade}`} style={{ fontSize: 15, textAlign: 'center' }}>
                {r.grade}
              </span>
              <span className="mono" style={{ fontSize: 16, textAlign: 'right', color: 'var(--text)' }}>
                {r.score.toLocaleString()}
              </span>
            </motion.li>
          ))}
        </ol>
      )}
    </motion.div>
  );
}
