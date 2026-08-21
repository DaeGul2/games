import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createShooter } from '../games/shooter';

export default function ShooterPage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createShooter(cv), []);
  return (
    <GameShell
      title="벡터 스트라이크"
      accent="#b09aff"
      mount={mount}
      hints={[
        { key: 'MOUSE', label: '이동 (사격 자동)' },
        { key: '↑↓←→', label: '키보드 이동' },
        { key: 'M', label: '음소거' },
      ]}
    />
  );
}
