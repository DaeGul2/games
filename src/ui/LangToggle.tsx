import { setLang, useLang, type Lang } from '../i18n';

const OPTIONS: [Lang, string][] = [
  ['th', 'ไทย'],
  ['ko', '한국어'],
];

/** 우상단 고정 언어 토글 — 기본 태국어, 선택은 이 PC에 저장 */
export default function LangToggle() {
  const lang = useLang();
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 20,
        display: 'flex',
        background: '#fff',
        border: '2px solid var(--line)',
        borderRadius: 10,
        padding: 3,
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      {OPTIONS.map(([code, label]) => {
        const on = code === lang;
        return (
          <button
            key={code}
            onClick={() => setLang(code)}
            aria-pressed={on}
            style={{
              border: 'none',
              cursor: on ? 'default' : 'pointer',
              borderRadius: 7,
              padding: '5px 12px',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              color: on ? '#fff' : '#5b5a86',
              background: on ? 'var(--violet)' : 'transparent',
              transition: 'background .15s, color .15s',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
