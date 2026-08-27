/**
 * 점수/등급 저장소 — localStorage 기반 (부스 운영 기간 동안 PC 로컬에 유지)
 */

export interface Grade {
  min: number;
  label: string;
  color: string;
  msg: string;
}

export interface ScoreRecord {
  score: number;
  grade: string;
  ts: number;
}

export const KEYS = {
  runner: 'kfood_arcade_runner',
  shooter: 'kfood_arcade_shooter',
  tower: 'kfood_arcade_tower',
  merge: 'kfood_arcade_merge',
  arrow: 'kfood_arcade_arrow',
} as const;

export function gradeOf(grades: Grade[], s: number): Grade {
  return grades.find(g => s >= g.min) ?? grades[grades.length - 1];
}

export function getScores(key: string): ScoreRecord[] {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]');
  } catch {
    return [];
  }
}

export function getBest(key: string): number {
  return Number(localStorage.getItem(key + '_best') ?? 0);
}

/** 점수를 기록하고 갱신된 최고점을 반환 */
export function saveScore(key: string, s: number, grades: Grade[]): number {
  const best = Math.max(getBest(key), s);
  localStorage.setItem(key + '_best', String(best));
  const list = getScores(key);
  list.push({ score: s, grade: gradeOf(grades, s).label, ts: Date.now() });
  list.sort((a, b) => b.score - a.score);
  localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
  return best;
}

export function resetAllScores() {
  for (const key of Object.values(KEYS)) {
    localStorage.removeItem(key);
    localStorage.removeItem(key + '_best');
  }
}
