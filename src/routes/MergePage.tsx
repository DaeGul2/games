import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createMerge } from '../games/merge';
import { T } from '../i18n';
import { PALETTES } from '../ui/palettes';

export default function MergePage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createMerge(cv), []);
  return (
    <GameShell
      title={T.merge.title}
      tagline={T.merge.tagline}
      palette={PALETTES.merge}
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
