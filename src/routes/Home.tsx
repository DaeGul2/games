import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GameCard from '../ui/GameCard';
import Leaderboard from '../ui/Leaderboard';
import { KEYS, getScores, resetAllScores, type ScoreRecord } from '../lib/score';
import { T, tr, splitBold } from '../i18n';

function Bold({ text, color }: { text: string; color: string }) {
  return (
    <>
      {splitBold(text).map(([s, b], i) => (b ? <strong key={i} style={{ color }}>{s}</strong> : <span key={i}>{s}</span>))}
    </>
  );
}

/* 카드 상단 미니 아트 — 각 게임의 실루엣 */
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

/* 접시 위에 음식이 쌓였다가 기우는 모습 */
function TowerArt() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" fill="none" aria-hidden>
      <motion.g
        animate={{ rotate: [-4, 4, -4] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '38px', originY: '58px' }}
      >
        <ellipse cx="38" cy="27" rx="9" ry="9" fill="#0d2415" />
        <ellipse cx="38" cy="27" rx="5.5" ry="5.5" fill="#f2f0e4" />
        <circle cx="38" cy="27" r="2.2" fill="#ffd23f" />
        <path d="M22 46 Q22 36 38 36 Q54 36 54 46 Z" fill="#efe0c0" />
        <rect x="18" y="46" width="40" height="9" rx="4.5" fill="#c67e26" />
      </motion.g>
      <rect x="12" y="57" width="52" height="6" rx="3" fill="#9aa6c4" />
      <rect x="30" y="63" width="16" height="4" rx="2" fill="#4d5570" />
    </svg>
  );
}

/* 작은 구슬 둘이 붙어 큰 구슬로 합쳐지는 모습 */
function MergeArt() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" fill="none" aria-hidden>
      <motion.circle
        cx="26" cy="46" r="11" fill="#ffc23a" fillOpacity="0.85"
        animate={{ cx: [26, 33, 26], opacity: [1, 0.4, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx="50" cy="46" r="11" fill="#35d6a4" fillOpacity="0.85"
        animate={{ cx: [50, 43, 50], opacity: [1, 0.4, 1] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx="38" cy="44" r="17" fill="#ff6f5e" fillOpacity="0.9"
        animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '38px', originY: '44px' }}
      />
      <rect x="10" y="62" width="56" height="5" rx="2.5" fill="#5b6486" />
      <rect x="8" y="20" width="4" height="46" rx="2" fill="#5b6486" />
      <rect x="64" y="20" width="4" height="46" rx="2" fill="#5b6486" />
    </svg>
  );
}

/* 아래에서 젓가락이 한 줄로 뻗어 올라가는 모습 */
function ArrowArt() {
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" fill="none" aria-hidden>
      {[16, 26, 38, 50, 60].map((x, i) => (
        <motion.rect
          key={x}
          x={x - 1.5} y="30" width="3" height="16" rx="1.5" fill="#f0d9a6"
          animate={{ y: [40, 4], opacity: [1, 0] }}
          transition={{ duration: 0.75, repeat: Infinity, ease: 'linear', delay: i * 0.07 }}
        />
      ))}
      <ellipse cx="38" cy="60" rx="17" ry="7" fill="#9fb4dd" />
      <ellipse cx="38" cy="56" rx="15" ry="5" fill="#fffdf4" />
      <motion.circle
        cx="38" cy="14" r="8" fill="#ff5f6e" fillOpacity="0.85"
        animate={{ scale: [1, 0.86, 1] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
        style={{ originX: '38px', originY: '14px' }}
      />
      <rect x="26" y="3" width="24" height="3" rx="1.5" fill="#4ade80" />
    </svg>
  );
}

export default function Home() {
  const [shooterScores, setShooterScores] = useState<ScoreRecord[]>([]);
  const [towerScores, setTowerScores] = useState<ScoreRecord[]>([]);
  const [mergeScores, setMergeScores] = useState<ScoreRecord[]>([]);
  const [arrowScores, setArrowScores] = useState<ScoreRecord[]>([]);

  const refresh = useCallback(() => {
    setShooterScores(getScores(KEYS.shooter));
    setTowerScores(getScores(KEYS.tower));
    setMergeScores(getScores(KEYS.merge));
    setArrowScores(getScores(KEYS.arrow));
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

  const totalPlays = shooterScores.length + towerScores.length + mergeScores.length + arrowScores.length;

  function onReset() {
    if (!confirm(T.home.resetConfirm)) return;
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
          {T.home.badge}
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
          {T.home.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          style={{ color: 'var(--dim)', marginTop: 16, fontSize: 16 }}
        >
          <Bold text={T.home.intro1} color="var(--gold)" />
          <br />
          <Bold text={T.home.intro2} color="var(--cyan)" />
        </motion.p>

        {totalPlays > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mono"
            style={{ marginTop: 18, fontSize: 13, color: 'var(--faint)' }}
          >
            {tr(T.home.plays, { n: totalPlays.toLocaleString() })}
          </motion.div>
        )}
      </header>

      {/* ===== 게임 카드 ===== */}
      <section style={{ display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 66 }}>
        <GameCard
          index={0}
          to="/shooter"
          title={T.shooter.title}
          tagline={T.shooter.tagline}
          accent="#b09aff"
          art={<ShooterArt />}
          bullets={T.shooter.bullets}
          controls={T.shooter.controls}
        />
        <GameCard
          index={1}
          to="/tower"
          title={T.tower.title}
          tagline={T.tower.tagline}
          accent="#ffb03a"
          art={<TowerArt />}
          bullets={T.tower.bullets}
          controls="←→ ↑ / SPACE"
        />
        <GameCard
          index={2}
          to="/merge"
          title={T.merge.title}
          tagline={T.merge.tagline}
          accent="#ff8a5c"
          art={<MergeArt />}
          bullets={T.merge.bullets}
          controls="MOUSE / SPACE"
        />
        <GameCard
          index={3}
          to="/arrow"
          title={T.arrow.title}
          tagline={T.arrow.tagline}
          accent="#ffd76a"
          art={<ArrowArt />}
          bullets={T.arrow.bullets}
          controls="MOUSE / ←→"
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
          <Leaderboard title={tr(T.common.top10, { game: T.shooter.title })} accent="#b09aff" records={shooterScores} delay={0.52} />
          <Leaderboard title={tr(T.common.top10, { game: T.tower.title })} accent="#ffb03a" records={towerScores} delay={0.6} />
          <Leaderboard title={tr(T.common.top10, { game: T.merge.title })} accent="#ff8a5c" records={mergeScores} delay={0.68} />
          <Leaderboard title={tr(T.common.top10, { game: T.arrow.title })} accent="#ffd76a" records={arrowScores} delay={0.76} />
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
          {T.home.reset}
        </motion.button>
        <p className="mono" style={{ marginTop: 16, fontSize: 11, color: '#333a55' }}>
          {T.home.credit}
        </p>
      </footer>
    </div>
  );
}
