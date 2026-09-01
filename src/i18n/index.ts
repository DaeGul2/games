/**
 * 활성 언어 — 여기 한 줄만 바꾸면 화면의 모든 글자가 바뀐다.
 *
 *   import { th } from './th';   export const T: Dict = th;
 */
import { ko, type Dict } from './ko';

export const T: Dict = ko;

/** 캔버스 글자용 폰트 — `ctx.font = \`bold 20px ${FONT}\`` */
export const FONT = T.canvasFont;

/** `{이름}` 자리표시자를 값으로 채운다 */
export function tr(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** 큰 수 줄임 (억/만/천 등 — 단위는 사전에서 온다) */
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
