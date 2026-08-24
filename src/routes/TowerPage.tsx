import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createTower } from '../games/tower';

export default function TowerPage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createTower(cv), []);
  return (
    <GameShell
      title="K-푸드 타워"
      accent="#ffb03a"
      mount={mount}
      hints={[
        { key: '←→', label: '이동' },
        { key: '↑', label: '회전' },
        { key: 'SPACE', label: '놓기' },
        { key: 'G', label: '무게중심 보기' },
      ]}
    />
  );
}
