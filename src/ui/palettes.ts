import type { GamePalette } from './GameCard';

/** 게임별 색 — global.css 의 --g-* 와 같은 값. 카드·순위표·플레이 페이지가 공유한다 */
export const PALETTES: Record<'shooter' | 'tower' | 'merge' | 'arrow', GamePalette> = {
  shooter: { accent: '#a77dff', border: '#d1bbff', title: '#7e57e8', btn: '#9c79ff', label: '#8e73e9' },
  tower: { accent: '#ffa63d', border: '#ffd198', title: '#f19319', btn: '#ffa52d', label: '#f19c2c' },
  merge: { accent: '#ff8ab9', border: '#ffc3da', title: '#f56aa4', btn: '#ff8dbe', label: '#f77fb2' },
  arrow: { accent: '#33d6c5', border: '#87e9df', title: '#1cc7b6', btn: '#3ad7cc', label: '#17bdb4' },
};
