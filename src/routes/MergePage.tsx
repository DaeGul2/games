import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createMerge } from '../games/merge';

export default function MergePage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createMerge(cv), []);
  return (
    <GameShell
      title="K-푸드 합치기"
      accent="#ff8a5c"
      mount={mount}
      hints={[
        { key: 'MOUSE', label: '조준' },
        { key: '←→', label: '조준' },
        { key: 'SPACE', label: '놓기' },
        { key: 'M', label: '음소거' },
      ]}
    />
  );
}
