import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useStructureStore } from '../store/structureStore';
import { profileColorAt } from '../core/profiles';
import {
  profileShapeOf,
  sectionOutline,
  type ProfileShape,
} from '../core/profileShapes';

/** Build the extruded member geometry: cross-section in XZ, length along Y. */
function buildMemberGeometry(
  shape: ProfileShape,
  sectionMm: number,
  length: number,
): THREE.ExtrudeGeometry {
  const outline = sectionOutline(shape, sectionMm);
  const section = new THREE.Shape();
  outline.outer.forEach(([x, y], i) =>
    i === 0 ? section.moveTo(x, y) : section.lineTo(x, y),
  );
  section.closePath();
  for (const holePts of outline.holes) {
    const hole = new THREE.Path();
    holePts.forEach(([x, y], i) =>
      i === 0 ? hole.moveTo(x, y) : hole.lineTo(x, y),
    );
    hole.closePath();
    section.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(section, {
    depth: length,
    bevelEnabled: false,
    steps: 1,
  });
  // Extrusion runs 0→length on +Z; center it, then map the axis onto +Y so the
  // mesh orients like the old cylinders (local +Y along the member).
  geo.translate(0, 0, -length / 2);
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

function ProfileEdge({
  edgeId,
  from,
  to,
  selected,
  shape,
  sectionMm,
  color,
}: {
  edgeId: string;
  from: [number, number, number];
  to: [number, number, number];
  selected: boolean;
  shape: ProfileShape;
  sectionMm: number;
  color: string;
}) {
  const setEdgeSelection = useStructureStore((s) => s.setEdgeSelection);
  const secondEdgeId = useStructureStore((s) => s.secondEdgeId);

  const frame = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const axis = new THREE.Vector3().subVectors(end, start);
    const len = axis.length();
    if (len < 1e-6) return null;
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    axis.normalize();
    // Stable orientation frame: roll the cross-section consistently instead of
    // the arbitrary twist setFromUnitVectors would give. Axis-aligned members
    // get axis-aligned faces (what you want for T/L/Bosch profiles).
    const upRef =
      Math.abs(axis.y) > 0.99
        ? new THREE.Vector3(0, 0, 1)
        : new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3().crossVectors(upRef, axis).normalize();
    const zAxis = new THREE.Vector3().crossVectors(xAxis, axis);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(xAxis, axis, zAxis),
    );
    return {
      position: [mid.x, mid.y, mid.z] as [number, number, number],
      quaternion,
      length: len,
    };
  }, [from, to]);

  const geometry = useMemo(
    () =>
      frame ? buildMemberGeometry(shape, sectionMm, frame.length) : null,
    [shape, sectionMm, frame],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!frame || !geometry) return null;

  return (
    <mesh
      position={frame.position}
      quaternion={frame.quaternion}
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation();
        const ev = e.nativeEvent;
        setEdgeSelection(edgeId, ev.shiftKey, ev.altKey);
      }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <meshStandardMaterial
        color={selected || secondEdgeId === edgeId ? '#111111' : color}
        metalness={0.72}
        roughness={0.34}
        envMapIntensity={0.9}
      />
    </mesh>
  );
}

export function StructureLines() {
  const nodes = useStructureStore((s) => s.nodes);
  const edges = useStructureStore((s) => s.edges);
  const profiles = useStructureStore((s) => s.profiles);
  const getEdgeProfile = useStructureStore((s) => s.getEdgeProfile);
  const selectedEdgeIds = useStructureStore((s) => s.selectedEdgeIds);
  const secondEdgeId = useStructureStore((s) => s.secondEdgeId);

  const profileIndex = useMemo(() => {
    const map: Record<string, number> = {};
    profiles.forEach((p, i) => {
      map[p.id] = i;
    });
    return map;
  }, [profiles]);

  return (
    <group>
      {edges.map((edge) => {
        const fromNode = nodes.find((n) => n.id === edge.fromId);
        const toNode = nodes.find((n) => n.id === edge.toId);
        if (!fromNode || !toNode) return null;
        const profile = getEdgeProfile(edge.id);
        const color = profileColorAt(profileIndex[profile.id] ?? 0);
        return (
          <ProfileEdge
            key={edge.id}
            edgeId={edge.id}
            from={fromNode.position}
            to={toNode.position}
            shape={profileShapeOf(profile)}
            sectionMm={profile.sectionMm}
            color={color}
            selected={
              selectedEdgeIds.includes(edge.id) || secondEdgeId === edge.id
            }
          />
        );
      })}
    </group>
  );
}
