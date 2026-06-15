import { useCallback, useRef } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStructureStore } from '../store/structureStore';
import { maybeSnapVec3 } from '../core/geometry';
import { makeWorkPlane, raycastToPlane } from '../core/workPlane';
import { StructureLines } from './StructureLines';
import { Nodes } from './Nodes';
import { DimensionLabels } from './DimensionLabels';
import { WorkPlaneVisual } from './WorkPlaneVisual';

function PlacementSurface() {
  const toolMode = useStructureStore((s) => s.toolMode);
  const snapToGrid = useStructureStore((s) => s.snapToGrid);
  const gridCellSize = useStructureStore((s) => s.gridCellSize);
  const workPlane = useStructureStore((s) => s.workPlane);
  const addNode = useStructureStore((s) => s.addNode);
  const nodes = useStructureStore((s) => s.nodes);
  const { raycaster, camera } = useThree();
  const intersect = useRef(new THREE.Vector3());

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (toolMode !== 'placeNode') return;
      e.stopPropagation();

      let pos: [number, number, number];
      if (workPlane === 'free') {
        pos = [e.point.x, e.point.y, e.point.z];
      } else {
        const anchor: [number, number, number] = nodes.length
          ? nodes[nodes.length - 1].position
          : [0, 0, 0];
        const plane = makeWorkPlane(workPlane, anchor);
        if (raycastToPlane(raycaster, plane, intersect.current)) {
          pos = [
            intersect.current.x,
            intersect.current.y,
            intersect.current.z,
          ];
        } else {
          pos = [e.point.x, e.point.y, e.point.z];
        }
      }
      addNode(maybeSnapVec3(pos, snapToGrid, gridCellSize));
    },
    [toolMode, snapToGrid, gridCellSize, workPlane, addNode, nodes, raycaster, camera],
  );

  if (toolMode !== 'placeNode') return null;

  return (
    <mesh onClick={handleClick}>
      <boxGeometry args={[400, 400, 400]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

export function StructureScene() {
  const nodes = useStructureStore((s) => s.nodes);
  let center: [number, number, number] = [40, 25, 25];
  if (nodes.length) {
    const sum: [number, number, number] = [0, 0, 0];
    for (const n of nodes) {
      sum[0] += n.position[0];
      sum[1] += n.position[1];
      sum[2] += n.position[2];
    }
    const c = nodes.length;
    center = [sum[0] / c, sum[1] / c, sum[2] / c];
  }

  return (
    <group>
      <WorkPlaneVisual />
      <PlacementSurface />
      <StructureLines />
      <Nodes />
      <DimensionLabels />
      <axesHelper args={[30]} position={center} />
    </group>
  );
}
