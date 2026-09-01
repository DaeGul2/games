/**
 * 활성 언어 — 런타임에 바꿀 수 있다 (우상단 토글). 기본은 태국어.
 *
 * `T` 는 항상 같은 객체이고 setLang() 이 내용물만 갈아끼운다.
 * 그래서 게임 코드는 그리는 순간에 `T.arrow.title` 처럼 읽기만 하면 된다.
 * 모듈 로드 시점에 문자열을 복사해 두면 안 된다 — getter 로 읽을 것 (grades.msg, 음식 이름 등 참고).
 */
import { useSyncExternalStore } from 'react';
import { ko, type Dict } from './ko';
import { th } from './th';

export type Lang = 'ko' | 'th';
const DICTS: Record<Lang, Dict> = { ko, th };
const STORAGE_KEY = 'kfood_arcade_lang';
const DEFAULT: Lang = 'th';

function stored(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ko' || v === 'th' ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let current: Lang = stored();

/** 활성 사전 — 객체 자체는 고정, 내용만 바뀐다 */
export const T: Dict = { ...DICTS[current] };

/** 캔버스 글자용 폰트 — `ctx.font = \`bold 20px ${FONT}\``. ESM live binding 이라 바꾸면 모든 import 가 따라온다 */
export let FONT = T.canvasFont;

const listeners = new Set<() => void>();

function applyDocument() {
  document.documentElement.lang = T.lang;
  document.documentElement.style.setProperty('--font-body', T.fontBody);
  document.title = T.meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', T.meta.description);
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  Object.assign(T, DICTS[lang]);
  FONT = T.canvasFont;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* 사생활 모드 등 — 저장 못 해도 동작엔 지장 없음 */ }
  applyDocument();
  listeners.forEach(l => l());
}

/** React 에서 현재 언어를 구독 — 바뀌면 리렌더 */
export function useLang(): Lang {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => current,
  );
}

applyDocument();

/** `{이름}` 자리표시자를 값으로 채운다 */
export function tr(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** 큰 수 줄임 (억/만/천 · K/M 등 — 단위는 사전에서 온다) */
export function fmtNum(n: number): string {
  for (const [base, suffix] of T.numUnits) {
    if (n >= base) {
      const v = n / base;
      return v.toFixed(v >= 10 ? 0 : 1) + suffix;
    }
  }
  return String(Math.round(n));
}

/** 홈 소개문의 `**강조**` 를 [텍스트, 강조여부] 조각으로 나눈다 */
export function splitBold(s: string): [string, boolean][] {
  return s.split('**').map((part, i) => [part, i % 2 === 1] as [string, boolean]).filter(([p]) => p !== '');
}

export type { Dict };
