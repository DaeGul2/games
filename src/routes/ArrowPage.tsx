import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createArrow } from '../games/arrow';
import { T } from '../i18n';

export default function ArrowPage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createArrow(cv), []);
  return (
    <GameShell
      title={T.arrow.title}
      accent="#ffd76a"
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
