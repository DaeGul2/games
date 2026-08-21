import { motion } from 'framer-motion';

/** 고정 배경: 원근 그리드 + 떠다니는 오브 + CRT 스캔라인 */
export default function Background() {
  return (
    <div className="bg-layer">
      <div className="bg-grid" />
      <motion.div
        className="bg-orb"
        style={{ width: 420, height: 420, left: '4%', top: '8%', background: 'rgba(0,255,200,.35)' }}
        animate={{ x: [0, 60, -20, 0], y: [0, 40, 80, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="bg-orb"
        style={{ width: 480, height: 480, right: '2%', top: '22%', background: 'rgba(176,154,255,.35)' }}
        animate={{ x: [0, -70, 20, 0], y: [0, 60, -30, 0] }}
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="bg-orb"
        style={{ width: 380, height: 380, left: '38%', bottom: '2%', background: 'rgba(255,95,158,.28)' }}
        animate={{ x: [0, 50, -50, 0], y: [0, -40, 20, 0] }}
        transition={{ duration: 29, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="bg-scan" />
    </div>
  );
}
