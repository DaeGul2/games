import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import GameCard from '../ui/GameCard';
import Leaderboard from '../ui/Leaderboard';
import { PALETTES } from '../ui/palettes';
import { KEYS, getScores, resetAllScores, type ScoreRecord } from '../lib/score';
import { T, tr, splitBold } from '../i18n';

function Bold({ text, color }: { text: string; color: string }) {
  return (
    <>
      {splitBold(text).map(([s, b], i) => (b ? <strong key={i} style={{ color }}>{s}</strong> : <span key={i}>{s}</span>))}
    </>
  );
}

/* 카드 아이콘 — 시안 2안 픽셀아트 (public/deco/icon-*.png) */
function Art({ name }: { name: string }) {
  return <img src={`/deco/icon-${name}.png`} alt="" className="pixel" style={{ width: 80, height: 'auto' }} />;
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
    <div className="wrap" style={{ padding: '96px 24px 90px' }}>
      {/* ===== 헤더 ===== */}
      <header style={{ textAlign: 'center', marginBottom: 48, position: 'relative' }}>
        {/* 시안 2안 — 제목 양옆 요리사 / 비빔밥 */}
        <motion.img
          src="/deco/chef.png" alt="" className="pixel deco-wide"
          style={{ position: 'absolute', left: 'max(0px, calc(50% - 560px))', top: 40, height: 170, width: 'auto' }}
          animate={{ y: [0, -5, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.img
          src="/deco/icon-merge.png" alt="" className="pixel deco-wide"
          style={{ position: 'absolute', right: 'max(0px, calc(50% - 560px))', top: 70, height: 120, width: 'auto' }}
          animate={{ y: [0, -4, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
        />
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="badge display"
          style={{ marginBottom: 20 }}
        >
          <motion.span
            animate={{ opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.7, repeat: Infinity }}
            style={{ width: 7, height: 7, background: '#2dae9c' }}
          />
          {T.home.badge}
        </motion.div>

        <motion.h1
          className="display"
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: 'clamp(40px, 7vw, 76px)',
            lineHeight: 1.05,
            background: 'linear-gradient(100deg, #59d6d6 0%, #7ab6ff 34%, #b48cff 66%, #f27cc7 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(3px 3px 0 #6070a8)',
          }}
        >
          {T.home.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          style={{ color: '#3f4254', marginTop: 16, fontSize: 16 }}
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
            style={{
              display: 'inline-block',
              marginTop: 18,
              fontSize: 12,
              color: '#a76946',
              background: '#fff6f1',
              border: '2px solid #eacfc1',
              borderRadius: 999,
              padding: '5px 14px',
            }}
          >
            {tr(T.home.plays, { n: totalPlays.toLocaleString() })}
          </motion.div>
        )}
      </header>

      {/* ===== 게임 카드 ===== */}
      <section style={{ display: 'flex', gap: 26, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 60 }}>
        <GameCard
          index={0}
          to="/shooter"
          title={T.shooter.title}
          tagline={T.shooter.tagline}
          palette={PALETTES.shooter}
          art={<Art name="shooter" />}
          bullets={T.shooter.bullets}
          controls={T.shooter.controls}
        />
        <GameCard
          index={1}
          to="/tower"
          title={T.tower.title}
          tagline={T.tower.tagline}
          palette={PALETTES.tower}
          art={<Art name="tower" />}
          bullets={T.tower.bullets}
          controls="←→ ↑ / SPACE"
        />
        <GameCard
          index={2}
          to="/merge"
          title={T.merge.title}
          tagline={T.merge.tagline}
          palette={PALETTES.merge}
          art={<Art name="merge" />}
          bullets={T.merge.bullets}
          controls="MOUSE / SPACE"
        />
        <GameCard
          index={3}
          to="/arrow"
          title={T.arrow.title}
          tagline={T.arrow.tagline}
          palette={PALETTES.arrow}
          art={<Art name="arrow" />}
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
          style={{ textAlign: 'center', fontSize: 15, letterSpacing: '.2em', color: 'var(--faint)', marginBottom: 20 }}
        >
          — HALL OF FAME —
        </motion.h2>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Leaderboard title={tr(T.common.top10, { game: T.shooter.title })} palette={PALETTES.shooter} records={shooterScores} delay={0.44} />
          <Leaderboard title={tr(T.common.top10, { game: T.tower.title })} palette={PALETTES.tower} records={towerScores} delay={0.52} />
          <Leaderboard title={tr(T.common.top10, { game: T.merge.title })} palette={PALETTES.merge} records={mergeScores} delay={0.6} />
          <Leaderboard title={tr(T.common.top10, { game: T.arrow.title })} palette={PALETTES.arrow} records={arrowScores} delay={0.68} />
        </div>
      </section>

      {/* ===== 푸터 / 운영자 ===== */}
      <footer style={{ textAlign: 'center', marginTop: 56, display: 'grid', gap: 14, justifyItems: 'center' }}>
        <div className="bubble" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <img src="/deco/heart-pink.png" alt="" className="pixel" style={{ width: 16 }} />
          {T.home.bubble}
        </div>
        <motion.button
          onClick={onReset}
          whileHover={{ y: -1, color: '#e96d73', borderColor: '#f3b5b8' }}
          whileTap={{ y: 1 }}
          style={{
            background: '#fff',
            border: '2px solid var(--line)',
            color: 'var(--faint)',
            padding: '8px 18px',
            borderRadius: 10,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 600,
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          {T.home.reset}
        </motion.button>
      </footer>

      {/* 화면 아래 양쪽 — aT 상점 / K-푸드 트럭 (시안 2안) */}
      <img src="/deco/store.png" alt="" className="pixel deco-fixed" style={{ left: 24, bottom: 22, width: 200 }} />
      <motion.img
        src="/deco/truck.png" alt="" className="pixel deco-fixed"
        style={{ right: 24, bottom: 20, width: 230 }}
        animate={{ y: [0, -2, 0] }} transition={{ duration: 0.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}
