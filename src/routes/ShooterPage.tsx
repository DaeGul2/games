import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createShooter } from '../games/shooter';
import { T } from '../i18n';
import { PALETTES } from '../ui/palettes';

export default function ShooterPage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createShooter(cv), []);
  return (
    <GameShell
      title={T.shooter.title}
      tagline={T.shooter.tagline}
      palette={PALETTES.shooter}
      mount={mount}
      hints={[
        { key: 'MOUSE', label: T.shooter.hintMouse },
        { key: '↑↓←→', label: T.shooter.hintKeys },
        { key: 'M', label: T.common.mute },
      ]}
    />
  );
}
