import { Canvas, useThree } from '@react-three/fiber';
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

type CapturedView = { camera: THREE.Camera; el: HTMLCanvasElement };

/** Exposes the live camera + canvas element to the DOM-level marquee handler. */
function CaptureView({ viewRef }: { viewRef: React.MutableRefObject<CapturedView | null> }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    viewRef.current = { camera, el: gl.domElement };
  }, [camera, gl, viewRef]);
  return null;
}

function CameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const viewPreset = useStructureStore((s) => s.viewPreset);
  const toolMode = useStructureStore((s) => s.toolMode);
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
      // Free the left mouse button for the marquee while box-selecting.
      enableRotate={toolMode !== 'box'}
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
      // Not pickable, so a click on empty space registers as a miss (deselect).
      raycast={() => {}}
    />
  );
}

type ViewportProps = {
  onFocusTranslate?: () => void;
};

type Marquee = { x: number; y: number; w: number; h: number; crossing: boolean };

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

  const viewRef = useRef<CapturedView | null>(null);
  const lastDown = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  const runMarquee = (
    sx: number,
    sy: number,
    ex: number,
    ey: number,
    additive: boolean,
  ) => {
    const view = viewRef.current;
    if (!view) return;
    const minX = Math.min(sx, ex);
    const maxX = Math.max(sx, ex);
    const minY = Math.min(sy, ey);
    const maxY = Math.max(sy, ey);
    if (maxX - minX < 4 && maxY - minY < 4) return; // a click, not a box

    const crossing = ex < sx; // right-to-left = crossing, left-to-right = window
    const { camera, el } = view;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const { nodes: ns, edges } = useStructureStore.getState();
    const v = new THREE.Vector3();
    const project = (p: [number, number, number]) => {
      v.set(p[0], p[1], p[2]).project(camera);
      return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, behind: v.z > 1 };
    };
    const inside = (q: { x: number; y: number; behind: boolean }) =>
      !q.behind && q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY;

    const ids: string[] = [];
    for (const e of edges) {
      const a = ns.find((n) => n.id === e.fromId);
      const b = ns.find((n) => n.id === e.toId);
      if (!a || !b) continue;
      const pa = project(a.position);
      const pb = project(b.position);
      if (crossing) {
        let hit = inside(pa) || inside(pb);
        for (let t = 1; t < 12 && !hit; t++) {
          const f = t / 12;
          hit = inside(
            project([
              a.position[0] + (b.position[0] - a.position[0]) * f,
              a.position[1] + (b.position[1] - a.position[1]) * f,
              a.position[2] + (b.position[2] - a.position[2]) * f,
            ]),
          );
        }
        if (hit) ids.push(e.id);
      } else if (inside(pa) && inside(pb)) {
        ids.push(e.id);
      }
    }
    useStructureStore.getState().selectEdges(ids, additive);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    lastDown.current = { x: e.clientX, y: e.clientY };
    if (toolMode !== 'box' || e.button !== 0) return;
    const view = viewRef.current;
    if (!view) return;
    const rect = view.el.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const move = (ev: PointerEvent) => {
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      setMarquee({
        x: Math.min(sx, x),
        y: Math.min(sy, y),
        w: Math.abs(x - sx),
        h: Math.abs(y - sy),
        crossing: x < sx,
      });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setMarquee(null);
      runMarquee(sx, sy, ev.clientX - rect.left, ev.clientY - rect.top, ev.shiftKey);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const handleMissed = (e: MouseEvent) => {
    // Ignore the tail of an orbit/marquee drag — only a real click clears.
    const moved = Math.hypot(e.clientX - lastDown.current.x, e.clientY - lastDown.current.y);
    if (moved > 5) return;
    const mode = useStructureStore.getState().toolMode;
    if (mode === 'select' || mode === 'box') {
      useStructureStore.getState().clearSelection();
    }
  };

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
        : toolMode === 'box'
          ? 'Box select — drag → window · ← crossing · Shift adds'
          : `Select — click member · Shift multi · click empty to clear${lockHint}${snapHint}`;

  return (
    <div
      className="viewport-wrap"
      onPointerDown={onPointerDown}
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
            onPointerMissed={handleMissed}
          >
            <ambientLight intensity={0.85} />
            <directionalLight position={[80, 120, 60]} intensity={0.6} />
            <CaptureView viewRef={viewRef} />
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
      {marquee && (
        <div
          className={`marquee ${marquee.crossing ? 'crossing' : ''}`}
          style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
        />
      )}
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
