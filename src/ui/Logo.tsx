import { Link } from 'react-router-dom';

/**
 * aT Center Bangkok 로고 — 좌상단 고정.
 *
 * 마크(public/at-mark.svg)는 공식 브랜드 가이드 .ai 에서 벡터 그대로 뽑은 것.
 * 공식 로고 문구는 "Korea Agro-Fisheries & Food Trade Corp." 이고
 * "aT Center Bangkok" 은 지사명이라 텍스트로 옆에 붙인다.
 * 크기·위치는 global.css 의 .site-logo (모바일에서 작아진다).
 */
export default function Logo() {
  return (
    <Link to="/" aria-label="aT Center Bangkok" className="site-logo">
      <img src="/at-mark.svg" alt="aT" />
      <span className="name">
        <b>aT Center Bangkok</b>
        <small>Korea Agro-Fisheries &amp; Food Trade Corp.</small>
      </span>
    </Link>
  );
}
