import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GameCard from '../ui/GameCard';
import Leaderboard from '../ui/Leaderboard';
import { KEYS, getScores, resetAllScores, type ScoreRecord } from '../lib/score';

/* 카드 상단 미니 아트 — 각 게임의 실루엣 */
function RunnerArt() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" fill="none" aria-hidden>
      <motion.g
        animate={{ y: [0, -9, 0] }}
        transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
      >
        <rect x="30" y="18" width="20" height="22" rx="3" fill="#00ffc8" />
        <rect x="42" y="24" width="6" height="5" fill="#05050c" />
        <rect x="30" y="40" width="6" height="10" fill="#00ffc8" />
        <rect x="43" y="40" width="6" height="10" fill="#00ffc8" />
      </motion.g>
      <rect x="8" y="56" width="60" height="2" rx="1" fill="#2a3550" />
      <rect x="56" y="44" width="12" height="12" rx="2" fill="#ffb03a" />
    </svg>
  );
}

function ShooterArt() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" fill="none" aria-hidden>
      <motion.g animate={{ y: [0, 5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}>
        <path d="M38 46 L48 66 L38 61 L28 66 Z" fill="#00ffc8" />
      </motion.g>
      <motion.rect
        x="36.5" y="26" width="3" height="12" rx="1.5" fill="#aefff0"
        animate={{ y: [26, 6], opacity: [1, 0] }}
        transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
      />
      <motion.g animate={{ rotate: 360 }} transition={{ duration: 7, repeat: Infinity, ease: 'linear' }} style={{ originX: '38px', originY: '18px' }}>
        <path d="M38 8 L48 18 L38 28 L28 18 Z" fill="#b09aff" />
        <circle cx="38" cy="18" r="3.6" fill="#05050c" />
      </motion.g>
    </svg>
  );
}

export default function Home() {
  const [runnerScores, setRunnerScores] = useState<ScoreRecord[]>([]);
  const [shooterScores, setShooterScores] = useState<ScoreRecord[]>([]);

  const refresh = useCallback(() => {
    setRunnerScores(getScores(KEYS.runner));
    setShooterScores(getScores(KEYS.shooter));
  }, []);

  useEffect(() => {
    refresh();
    const onVis = () => !document.hidden && refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  const totalPlays = runnerScores.length + shooterScores.length;

  function onReset() {
    if (!confirm('모든 게임 기록을 삭제할까요? (되돌릴 수 없음)')) return;
    resetAllScores();
    refresh();
  }

  return (
    <div className="wrap" style={{ padding: '64px 24px 80px' }}>
      {/* ===== 헤더 ===== */}
      <header style={{ textAlign: 'center', marginBottom: 56 }}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="display"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
            fontSize: 11,
            letterSpacing: '.28em',
            color: 'var(--cyan)',
            border: '1px solid rgba(0,255,200,.28)',
            borderRadius: 99,
            padding: '7px 16px',
            marginBottom: 22,
            background: 'rgba(0,255,200,.06)',
          }}
        >
          <motion.span
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.7, repeat: Infinity }}
            style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--cyan)' }}
          />
          NOW OPEN · PC방 부스
        </motion.div>

        <motion.h1
          className="display"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: 'clamp(38px, 7vw, 74px)',
            fontWeight: 900,
            lineHeight: 1.05,
            background: 'linear-gradient(100deg, #00ffc8 0%, #b09aff 48%, #ff5f9e 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 6px 34px rgba(176,154,255,.34))',
          }}
        >
          K-FOOD 게임천국
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{ color: 'var(--dim)', marginTop: 16, fontSize: 16 }}
        >
          게임에서 점수를 올리고 <strong style={{ color: 'var(--gold)' }}>등급</strong>을 받아
          <br />
          부스에서 <strong style={{ color: 'var(--cyan)' }}>음식 포인트</strong>로 교환하세요
        </motion.p>

        {totalPlays > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mono"
            style={{ marginTop: 18, fontSize: 13, color: 'var(--faint)' }}
          >
            오늘 플레이 {totalPlays.toLocaleString()}회
          </motion.div>
        )}
      </header>

      {/* ===== 게임 카드 ===== */}
      <section style={{ display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 66 }}>
        <GameCard
          index={0}
          to="/runner"
          title="네온 러너"
          tagline="리듬을 타고 질주하라"
          accent="#00ffc8"
          art={<RunnerArt />}
          bullets={[
            '점프 · 2단 점프 · 숙이기 · 급강하 콤보',
            '달릴수록 빨라지는 무한 러너',
            'BGM 템포도 속도에 맞춰 상승',
          ]}
          controls="SPACE / ↓"
        />
        <GameCard
          index={1}
          to="/shooter"
          title="벡터 스트라이크"
          tagline="탄막을 뚫고 보스를 격파하라"
          accent="#b09aff"
          art={<ShooterArt />}
          bullets={[
            'P 아이템으로 무기 Lv.5까지 강화',
            '15웨이브 + 최종보스 3단 페이즈',
            '클리어 보너스로 S등급 도전',
          ]}
          controls="MOUSE / 자동 사격"
        />
      </section>

      {/* ===== 순위표 ===== */}
      <section>
        <motion.h2
          className="display"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ textAlign: 'center', fontSize: 15, letterSpacing: '.24em', color: 'var(--faint)', marginBottom: 22 }}
        >
          — HALL OF FAME —
        </motion.h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Leaderboard title="네온 러너 TOP 10" accent="#00ffc8" records={runnerScores} delay={0.44} />
          <Leaderboard title="벡터 스트라이크 TOP 10" accent="#b09aff" records={shooterScores} delay={0.52} />
        </div>
      </section>

      {/* ===== 운영자 ===== */}
      <footer style={{ textAlign: 'center', marginTop: 60 }}>
        <motion.button
          onClick={onReset}
          whileHover={{ scale: 1.03, borderColor: 'rgba(255,95,95,.6)', color: '#ff6b6b' }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: 'transparent',
            border: '1px solid rgba(120,130,200,.2)',
            color: 'var(--faint)',
            padding: '10px 22px',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
          }}
        >
          기록 전체 초기화 (운영자용)
        </motion.button>
        <p className="mono" style={{ marginTop: 16, fontSize: 11, color: '#333a55' }}>
          모든 그래픽·사운드는 코드로 생성됩니다 · 외부 저작물 없음
        </p>
      </footer>
    </div>
  );
}
