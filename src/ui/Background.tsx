import { motion, type TargetAndTransition } from 'framer-motion';

const ORBS: { style: React.CSSProperties; drift: TargetAndTransition; dur: number }[] = [
  {
    style: { width: 420, height: 420, left: '4%', top: '8%', background: 'rgba(0,255,200,.35)' },
    drift: { x: [0, 60, -20, 0], y: [0, 40, 80, 0] },
    dur: 26,
  },
  {
    style: { width: 480, height: 480, right: '2%', top: '22%', background: 'rgba(176,154,255,.35)' },
    drift: { x: [0, -70, 20, 0], y: [0, 60, -30, 0] },
    dur: 32,
  },
  {
    style: { width: 380, height: 380, left: '38%', bottom: '2%', background: 'rgba(255,95,158,.28)' },
    drift: { x: [0, 50, -50, 0], y: [0, -40, 20, 0] },
    dur: 29,
  },
];

/**
 * 고정 배경: 원근 그리드 + 떠다니는 오브 + CRT 스캔라인.
 * quiet=true(게임 화면)이면 움직임을 멈춰 캔버스 렌더에 자원을 양보한다.
 */
export default function Background({ quiet = false }: { quiet?: boolean }) {
  return (
    <div className={`bg-layer${quiet ? ' quiet' : ''}`}>
      <div className="bg-grid" />
      {ORBS.map((o, i) => (
        <motion.div
          key={i}
          className="bg-orb"
          style={o.style}
          animate={quiet ? undefined : o.drift}
          transition={quiet ? undefined : { duration: o.dur, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      <div className="bg-scan" />
    </div>
  );
}
