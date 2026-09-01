import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createMerge } from '../games/merge';
import { T } from '../i18n';

export default function MergePage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createMerge(cv), []);
  return (
    <GameShell
      title={T.merge.title}
      accent="#ff8a5c"
      mount={mount}
      hints={[
        { key: 'MOUSE', label: T.merge.hintAim },
        { key: '←→', label: T.merge.hintAim },
        { key: 'SPACE', label: T.merge.hintDrop },
        { key: 'M', label: T.common.mute },
      ]}
    />
  );
}
