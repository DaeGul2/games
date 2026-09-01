import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createArrow } from '../games/arrow';
import { T } from '../i18n';
import { PALETTES } from '../ui/palettes';

export default function ArrowPage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createArrow(cv), []);
  return (
    <GameShell
      title={T.arrow.title}
      tagline={T.arrow.tagline}
      palette={PALETTES.arrow}
      mount={mount}
      hints={[
        { key: 'MOUSE', label: T.arrow.hintMove },
        { key: '←→', label: T.arrow.hintMove },
        { key: 'AUTO', label: T.arrow.hintAuto },
        { key: 'M', label: T.common.mute },
      ]}
    />
  );
}
