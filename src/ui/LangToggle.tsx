import { setLang, useLang, type Lang } from '../i18n';

const OPTIONS: [Lang, string][] = [
  ['th', 'ไทย'],
  ['ko', '한국어'],
];

/** 우상단 고정 언어 토글 — 기본 태국어, 선택은 이 기기에 저장. 스타일은 .lang-toggle */
export default function LangToggle() {
  const lang = useLang();
  return (
    <div role="group" aria-label="Language" className="lang-toggle">
      {OPTIONS.map(([code, label]) => {
        const on = code === lang;
        return (
          <button
            key={code}
            onClick={() => setLang(code)}
            aria-pressed={on}
            style={{ cursor: on ? 'default' : 'pointer' }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
