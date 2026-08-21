import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createRunner } from '../games/runner';

export default function RunnerPage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createRunner(cv), []);
  return (
    <GameShell
      title="네온 러너"
      accent="#00ffc8"
      mount={mount}
      hints={[
        { key: 'SPACE', label: '점프 / 2단 점프' },
        { key: '↓', label: '숙이기 / 급강하' },
        { key: 'M', label: '음소거' },
      ]}
    />
  );
}
