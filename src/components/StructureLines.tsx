import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useStructureStore } from '../store/structureStore';
import { resolveProfileColor } from '../core/profiles';
import {
  profileShapeOf,
  sectionOutline,
  type ProfileShape,
} from '../core/profileShapes';
import {
  computeBracketPlacements,
  computeJointTreatments,
  type BracketPlacement,
  type EdgeTreatment,
} from '../core/jointVisuals';
import type { Vec3 } from '../core/types';

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

const NO_TREATMENT: EdgeTreatment = { from: { trim: 0 }, to: { trim: 0 } };

function ProfileEdge({
  edgeId,
  from,
  to,
  selected,
  shape,
  sectionMm,
  color,
  treatment,
}: {
  edgeId: string;
  from: Vec3;
  to: Vec3;
  selected: boolean;
  shape: ProfileShape;
  sectionMm: number;
  color: string;
  treatment: EdgeTreatment;
}) {
  const setEdgeSelection = useStructureStore((s) => s.setEdgeSelection);
  const secondEdgeId = useStructureStore((s) => s.secondEdgeId);

  const trimFrom = treatment.from.trim;
  const trimTo = treatment.to.trim;

  const frame = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const axis = new THREE.Vector3().subVectors(end, start);
    const len = axis.length();
    if (len < 1e-6) return null;
    axis.normalize();
    // The rendered segment spans [from + axis·trimFrom, to − axis·trimTo]
    // (negative trims extend the member for mitre corners).
    const renderLength = Math.max(1, len - trimFrom - trimTo);
    const mid = new THREE.Vector3()
      .addVectors(start, end)
      .multiplyScalar(0.5)
      .addScaledVector(axis, (trimFrom - trimTo) / 2);
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
      length: renderLength,
    };
  }, [from, to, trimFrom, trimTo]);

  const geometry = useMemo(
    () => (frame ? buildMemberGeometry(shape, sectionMm, frame.length) : null),
    [shape, sectionMm, frame],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

  // Mitre cuts: world-space clipping planes through the shared node, keeping
  // this member's half of the corner.
  const clipFrom = treatment.from.clipNormal;
  const clipTo = treatment.to.clipNormal;
  const clippingPlanes = useMemo(() => {
    const planes: THREE.Plane[] = [];
    if (clipFrom) {
      planes.push(
        new THREE.Plane().setFromNormalAndCoplanarPoint(
          new THREE.Vector3(...clipFrom),
          new THREE.Vector3(...from),
        ),
      );
    }
    if (clipTo) {
      planes.push(
        new THREE.Plane().setFromNormalAndCoplanarPoint(
          new THREE.Vector3(...clipTo),
          new THREE.Vector3(...to),
        ),
      );
    }
    return planes;
  }, [clipFrom, clipTo, from, to]);

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
        clippingPlanes={clippingPlanes.length > 0 ? clippingPlanes : null}
        side={clippingPlanes.length > 0 ? THREE.DoubleSide : THREE.FrontSide}
      />
    </mesh>
  );
}

/** A steel angle bracket sitting in the corner between two members. */
function BracketMesh({ placement }: { placement: BracketPlacement }) {
  const parts = useMemo(() => {
    const u = new THREE.Vector3(...placement.legA); // butting member dir
    const v = new THREE.Vector3(...placement.legB); // through member dir
    // Orthonormal corner frame (guard near-parallel, filtered upstream).
    const vPerp = v.clone().addScaledVector(u, -u.dot(v));
    if (vPerp.lengthSq() < 1e-9) return null;
    vPerp.normalize();
    const n = new THREE.Vector3().crossVectors(u, vPerp);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(u, vPerp, n),
    );
    const P = new THREE.Vector3(...placement.position);
    const sA = placement.sectionA; // butting section (thickness across vPerp)
    const sB = placement.sectionB; // through section (thickness across u)
    const minS = Math.min(sA, sB);
    const L = Math.min(45, Math.max(8, minS * 0.9));
    const t = Math.max(2.5, minS * 0.12);
    const w = Math.max(6, minS * 0.8);
    // Leg on the butting member's face + leg on the through member's face.
    const leg1 = {
      position: P.clone()
        .addScaledVector(u, sB / 2 + L / 2)
        .addScaledVector(vPerp, sA / 2 + t / 2),
      size: [L, t, w] as [number, number, number],
    };
    const leg2 = {
      position: P.clone()
        .addScaledVector(u, sB / 2 + t / 2)
        .addScaledVector(vPerp, sA / 2 + L / 2),
      size: [t, L, w] as [number, number, number],
    };
    return { quaternion, legs: [leg1, leg2] };
  }, [placement]);

  if (!parts) return null;
  return (
    <group>
      {parts.legs.map((leg, i) => (
        <mesh
          key={i}
          position={leg.position}
          quaternion={parts.quaternion}
          raycast={() => {}}
        >
          <boxGeometry args={leg.size} />
          <meshStandardMaterial
            color="#565b63"
            metalness={0.6}
            roughness={0.45}
            envMapIntensity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

export function StructureLines() {
  const nodes = useStructureStore((s) => s.nodes);
  const edges = useStructureStore((s) => s.edges);
  const profiles = useStructureStore((s) => s.profiles);
  const edgeProfile = useStructureStore((s) => s.edgeProfile);
  const jointId = useStructureStore((s) => s.jointId);
  const lockedEdgeIds = useStructureStore((s) => s.lockedEdgeIds);
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

  const sectionOf = useMemo(() => {
    const byId = new Map(profiles.map((p) => [p.id, p]));
    return (edgeId: string) =>
      (byId.get(edgeProfile[edgeId] ?? '') ?? profiles[0]).sectionMm;
  }, [profiles, edgeProfile]);

  const treatments = useMemo(
    () => computeJointTreatments(nodes, edges, sectionOf, jointId),
    [nodes, edges, sectionOf, jointId],
  );

  const brackets = useMemo(
    () =>
      jointId === 'bracket'
        ? computeBracketPlacements(nodes, edges, sectionOf)
        : [],
    [jointId, nodes, edges, sectionOf],
  );

  return (
    <group>
      {edges.map((edge) => {
        const fromNode = nodes.find((n) => n.id === edge.fromId);
        const toNode = nodes.find((n) => n.id === edge.toId);
        if (!fromNode || !toNode) return null;
        const profile = getEdgeProfile(edge.id);
        // Locked parts render in neutral grey so their pinned state is visible.
        const color = lockedEdgeIds.includes(edge.id)
          ? '#9aa0a6'
          : resolveProfileColor(profile, profileIndex[profile.id] ?? 0);
        return (
          <ProfileEdge
            key={edge.id}
            edgeId={edge.id}
            from={fromNode.position}
            to={toNode.position}
            shape={profileShapeOf(profile)}
            sectionMm={profile.sectionMm}
            color={color}
            treatment={treatments.get(edge.id) ?? NO_TREATMENT}
            selected={
              selectedEdgeIds.includes(edge.id) || secondEdgeId === edge.id
            }
          />
        );
      })}
      {brackets.map((p, i) => (
        <BracketMesh key={i} placement={p} />
      ))}
    </group>
  );
}
