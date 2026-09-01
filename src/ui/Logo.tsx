import { Link } from 'react-router-dom';

/**
 * aT Center Bangkok 로고 — 좌상단 고정.
 *
 * 마크(public/at-mark.svg)는 공식 브랜드 가이드 .ai 에서 벡터 그대로 뽑은 것.
 * 공식 로고 문구는 "Korea Agro-Fisheries & Food Trade Corp." 이고
 * "aT Center Bangkok" 은 지사명이라 텍스트로 옆에 붙인다.
 */
export default function Logo() {
  return (
    <Link
      to="/"
      aria-label="aT Center Bangkok"
      style={{
        position: 'fixed',
        top: 22,
        left: 24,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
      }}
    >
      <img src="/at-mark.svg" alt="aT" style={{ height: 40, width: 'auto', display: 'block' }} />
      <span style={{ display: 'grid', lineHeight: 1.15, paddingTop: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: '#004e51', letterSpacing: '-0.01em' }}>aT Center Bangkok</span>
        <span style={{ fontSize: 10, fontWeight: 500, color: '#4f7a70' }}>Korea Agro-Fisheries &amp; Food Trade Corp.</span>
      </span>
    </Link>
  );
}
