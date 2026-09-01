import { useCallback } from 'react';
import GameShell from '../ui/GameShell';
import { createTower } from '../games/tower';
import { T } from '../i18n';
import { PALETTES } from '../ui/palettes';

export default function TowerPage() {
  const mount = useCallback((cv: HTMLCanvasElement) => createTower(cv), []);
  return (
    <GameShell
      title={T.tower.title}
      tagline={T.tower.tagline}
      palette={PALETTES.tower}
      mount={mount}
      hints={[
        { key: '←→', label: T.tower.hintMove },
        { key: '↑↓', label: T.tower.hintRotate },
        { key: 'SPACE', label: T.tower.hintDrop },
        { key: 'G', label: T.tower.hintCom },
      ]}
    />
  );
}
