import { useRef, useState } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useStructureStore } from '../store/structureStore';
import { maybeSnapVec3 } from '../core/geometry';
import { getNodeRadiusMm } from '../core/visualScale';
import {
  applyAxisLock,
  makeCameraPlane,
  makeWorkPlane,
  raycastToPlane,
} from '../core/workPlane';
import type { Vec3 } from '../core/types';

function NodeSphere({
  id,
  position,
  selected,
  connectHighlight,
  nodeRadius,
}: {
  id: string;
  position: [number, number, number];
  selected: boolean;
  connectHighlight: boolean;
  nodeRadius: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<Vec3 | null>(null);
  const toolMode = useStructureStore((s) => s.toolMode);
  const snapToGrid = useStructureStore((s) => s.snapToGrid);
  const gridCellSize = useStructureStore((s) => s.gridCellSize);
  const workPlane = useStructureStore((s) => s.workPlane);
  const axisLock = useStructureStore((s) => s.axisLock);
  const setSelection = useStructureStore((s) => s.setSelection);
  const moveNode = useStructureStore((s) => s.moveNode);
  const finishNodeDrag = useStructureStore((s) => s.finishNodeDrag);
  const pushHistory = useStructureStore((s) => s.pushHistory);
  const startConnect = useStructureStore((s) => s.startConnect);
  const finishConnect = useStructureStore((s) => s.finishConnect);
  const connectFromId = useStructureStore((s) => s.connectFromId);
  const { raycaster, camera, gl } = useThree();
  const intersect = useRef(new THREE.Vector3());

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (toolMode === 'connect') {
      if (connectFromId) finishConnect(id);
      else startConnect(id);
      return;
    }
    if (toolMode === 'select') {
      setSelection({ type: 'node', id });
      pushHistory();
      dragOrigin.current = [...position];
      (e.target as unknown as HTMLElement)?.setPointerCapture?.(e.pointerId);
      setDragging(true);
    }
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging || toolMode !== 'select' || !dragOrigin.current) return;
    const pe = e.nativeEvent;
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((pe.clientX - rect.left) / rect.width) * 2 - 1,
      -((pe.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(mouse, camera);

    let candidate: Vec3;
    if (axisLock) {
      const plane =
        workPlane === 'free'
          ? makeCameraPlane(camera, dragOrigin.current)
          : makeWorkPlane(workPlane, dragOrigin.current);
      if (!raycastToPlane(raycaster, plane, intersect.current)) return;
      candidate = [
        intersect.current.x,
        intersect.current.y,
        intersect.current.z,
      ];
      candidate = applyAxisLock(dragOrigin.current, candidate, axisLock);
    } else if (workPlane === 'free') {
      const plane = makeCameraPlane(camera, position);
      if (!raycastToPlane(raycaster, plane, intersect.current)) return;
      candidate = [
        intersect.current.x,
        intersect.current.y,
        intersect.current.z,
      ];
    } else {
      const plane = makeWorkPlane(workPlane, position);
      if (!raycastToPlane(raycaster, plane, intersect.current)) return;
      candidate = [
        intersect.current.x,
        intersect.current.y,
        intersect.current.z,
      ];
    }

    moveNode(id, maybeSnapVec3(candidate, snapToGrid, gridCellSize), {
      skipEnforce: true,
    });
  };

  const handlePointerUp = () => {
    if (dragging) {
      finishNodeDrag();
    }
    setDragging(false);
    dragOrigin.current = null;
  };

  const scale = selected || connectHighlight ? 1.35 : 1;

  return (
    <mesh
      ref={meshRef}
      position={position}
      scale={scale}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <sphereGeometry args={[nodeRadius, 16, 16]} />
      <meshStandardMaterial
        color={selected || connectHighlight ? '#111111' : '#ffffff'}
        emissive={selected ? '#222222' : '#000000'}
        metalness={0}
        roughness={0.4}
      />
    </mesh>
  );
}

export function Nodes() {
  const nodes = useStructureStore((s) => s.nodes);
  const profiles = useStructureStore((s) => s.profiles);
  const selection = useStructureStore((s) => s.selection);
  const connectFromId = useStructureStore((s) => s.connectFromId);

  const maxSectionMm = profiles.reduce(
    (max, p) => Math.max(max, p.sectionMm),
    20,
  );
  const nodeRadius = getNodeRadiusMm(maxSectionMm);

  return (
    <group>
      {nodes.map((node) => (
        <NodeSphere
          key={node.id}
          id={node.id}
          position={node.position}
          selected={selection?.type === 'node' && selection.id === node.id}
          connectHighlight={connectFromId === node.id}
          nodeRadius={nodeRadius}
        />
      ))}
    </group>
  );
}
