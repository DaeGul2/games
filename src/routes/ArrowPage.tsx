import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createArrow } from '../games/arrow';

export default function ArrowPage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createArrow(cv), []);
  return (
    <GameShell
      title="K-푸드 사격"
      accent="#ffd76a"
      mount={mount}
      hints={[
        { key: 'MOUSE', label: '좌우 이동' },
        { key: '←→', label: '좌우 이동' },
        { key: 'AUTO', label: '발사는 자동' },
        { key: 'M', label: '음소거' },
      ]}
    />
  );
}
