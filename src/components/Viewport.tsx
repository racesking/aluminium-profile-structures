import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useRef, useEffect, useState } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { useStructureStore } from '../store/structureStore';
import {
  cameraDistanceForSpan,
  getStructureBounds,
} from '../core/visualScale';
import { StructureScene } from './StructureScene';
import { ContextMenu, type ContextMenuState } from './ContextMenu';
import { HelpModal } from './HelpModal';
import { MemberDimensionModal } from './MemberDimensionModal';
import { ErrorBoundary, CanvasErrorFallback } from './ErrorBoundary';

const VIEW_DIRECTIONS: Record<
  string,
  { pos: [number, number, number]; up?: [number, number, number] }
> = {
  perspective: { pos: [1, 0.85, 1] },
  top: { pos: [0, 1, 0.001], up: [0, 0, -1] },
  front: { pos: [0, 0.15, 1], up: [0, 1, 0] },
  right: { pos: [1, 0.15, 0], up: [0, 1, 0] },
};

function CameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const viewPreset = useStructureStore((s) => s.viewPreset);
  const nodes = useStructureStore((s) => s.nodes);

  const nodeKey = useStructureStore((s) =>
    s.nodes.length === 0
      ? ''
      : s.nodes
          .map((n) => n.position.join(','))
          .join('|'),
  );

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { center, span } = getStructureBounds(nodes);
    const dist = cameraDistanceForSpan(span);
    const dir = VIEW_DIRECTIONS[viewPreset] ?? VIEW_DIRECTIONS.perspective;
    const d = new THREE.Vector3(...dir.pos).normalize().multiplyScalar(dist);
    controls.object.position.set(
      center[0] + d.x,
      center[1] + d.y,
      center[2] + d.z,
    );
    if (dir.up) controls.object.up.set(...dir.up);
    else controls.object.up.set(0, 1, 0);
    controls.target.set(...center);
    controls.update();
  }, [viewPreset, nodeKey, nodes]);

  const { center, span } = getStructureBounds(nodes);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={Math.max(5, span * 0.05)}
      maxDistance={Math.max(50000, span * 50)}
      target={center}
    />
  );
}

function SceneGrid() {
  const gridCellSize = useStructureStore((s) => s.gridCellSize);
  const nodes = useStructureStore((s) => s.nodes);
  const { span } = getStructureBounds(nodes);
  const sectionSize = Math.max(gridCellSize * 5, 10);
  const fade = Math.max(500, span * 3);

  return (
    <Grid
      cellSize={gridCellSize}
      cellThickness={0.5}
      sectionSize={sectionSize}
      sectionThickness={0.9}
      fadeDistance={fade}
      infiniteGrid
      cellColor="#cccccc"
      sectionColor="#999999"
    />
  );
}

type ViewportProps = {
  onFocusTranslate?: () => void;
};

export function Viewport({ onFocusTranslate }: ViewportProps) {
  const toolMode = useStructureStore((s) => s.toolMode);
  const connectFromId = useStructureStore((s) => s.connectFromId);
  const workPlane = useStructureStore((s) => s.workPlane);
  const axisLock = useStructureStore((s) => s.axisLock);
  const snapToGrid = useStructureStore((s) => s.snapToGrid);
  const gridCellSize = useStructureStore((s) => s.gridCellSize);
  const nodes = useStructureStore((s) => s.nodes);
  const { span } = getStructureBounds(nodes);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [dimensionOpen, setDimensionOpen] = useState(false);

  const planeHint =
    workPlane === 'free' ? '3D space' : `${workPlane.toUpperCase()} plane`;
  const lockHint = axisLock ? ` · lock ${axisLock.toUpperCase()}` : '';
  const snapHint = snapToGrid ? ` · grid ${gridCellSize}mm` : ' · snap off';

  const modeLabel =
    toolMode === 'placeNode'
      ? `Place node — click (${planeHint})`
      : toolMode === 'connect'
        ? connectFromId
          ? 'Connect — click second node'
          : 'Connect — click first node'
        : `Select — drag on ${planeHint}${lockHint}${snapHint}`;

  return (
    <div
      className="viewport-wrap"
      onContextMenu={(e) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="viewport-canvas">
        <ErrorBoundary
          fallback={(reset) => <CanvasErrorFallback onReset={reset} />}
        >
          <Canvas
            style={{ width: '100%', height: '100%', display: 'block' }}
            camera={{
              position: [120, 100, 120],
              fov: 45,
              near: 0.1,
              far: Math.max(200000, span * 100),
            }}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setClearColor('#f4f4f4');
            }}
          >
            <ambientLight intensity={0.85} />
            <directionalLight position={[80, 120, 60]} intensity={0.6} />
            <SceneGrid />
            <StructureScene />
            <CameraController />
            <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
              <GizmoViewport
                axisColors={['#111', '#444', '#888']}
                labelColor="#111"
              />
            </GizmoHelper>
          </Canvas>
        </ErrorBoundary>
      </div>
      <div className="mode-badge">{modeLabel}</div>
      <ContextMenu
        menu={contextMenu}
        onClose={() => setContextMenu(null)}
        onTranslate={() => onFocusTranslate?.()}
        onMemberDimension={() => setDimensionOpen(true)}
        onHelp={() => setHelpOpen(true)}
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <MemberDimensionModal
        open={dimensionOpen}
        onClose={() => setDimensionOpen(false)}
      />
    </div>
  );
}
