import { useMemo } from 'react';
import * as THREE from 'three';
import { useStructureStore } from '../store/structureStore';
import { getMemberRadiusMm, getProfileSectionMm } from '../core/visualScale';

function ProfileEdge({
  edgeId,
  from,
  to,
  selected,
  radius,
}: {
  edgeId: string;
  from: [number, number, number];
  to: [number, number, number];
  selected: boolean;
  radius: number;
}) {
  const setEdgeSelection = useStructureStore((s) => s.setEdgeSelection);
  const secondEdgeId = useStructureStore((s) => s.secondEdgeId);

  const { position, rotation, length } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize(),
    );
    const euler = new THREE.Euler().setFromQuaternion(quat);
    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      rotation: [euler.x, euler.y, euler.z] as [number, number, number],
      length: len,
    };
  }, [from, to]);

  return (
    <mesh
      position={position}
      rotation={rotation}
      onClick={(e) => {
        e.stopPropagation();
        const ev = e.nativeEvent;
        setEdgeSelection(edgeId, ev.shiftKey, ev.altKey);
      }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <cylinderGeometry args={[radius, radius, length, 10]} />
      <meshStandardMaterial
        color={
          selected || secondEdgeId === edgeId ? '#111111' : '#888888'
        }
        metalness={0.1}
        roughness={0.6}
      />
    </mesh>
  );
}

export function StructureLines() {
  const nodes = useStructureStore((s) => s.nodes);
  const edges = useStructureStore((s) => s.edges);
  const profile = useStructureStore((s) => s.profile);
  const selectedEdgeIds = useStructureStore((s) => s.selectedEdgeIds);
  const secondEdgeId = useStructureStore((s) => s.secondEdgeId);

  const radius = getMemberRadiusMm(getProfileSectionMm(profile));

  return (
    <group>
      {edges.map((edge) => {
        const fromNode = nodes.find((n) => n.id === edge.fromId);
        const toNode = nodes.find((n) => n.id === edge.toId);
        if (!fromNode || !toNode) return null;
        return (
          <ProfileEdge
            key={edge.id}
            edgeId={edge.id}
            from={fromNode.position}
            to={toNode.position}
            radius={radius}
            selected={
              selectedEdgeIds.includes(edge.id) || secondEdgeId === edge.id
            }
          />
        );
      })}
    </group>
  );
}
