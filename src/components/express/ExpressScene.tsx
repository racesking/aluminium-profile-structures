import { useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type { ExpressMember } from '../../core/templates';
import {
  cameraDistanceForSpan,
  getStructureBounds,
} from '../../core/visualScale';
import type { Node } from '../../core/types';

function boundsOf(members: ExpressMember[]) {
  const points: Node[] = members.flatMap((m) => [
    { id: '', position: m.from },
    { id: '', position: m.to },
  ]);
  return getStructureBounds(points);
}

function MemberBox({
  member,
  color,
  section,
}: {
  member: ExpressMember;
  color: string;
  section: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const start = new THREE.Vector3(...member.from);
    const end = new THREE.Vector3(...member.to);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.normalize(),
    );
    return { position: mid, quaternion: quat, length: len };
  }, [member]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[section, length, section]} />
      <meshStandardMaterial color={color} metalness={0.05} roughness={0.4} />
    </mesh>
  );
}

function FitCamera({ members }: { members: ExpressMember[] }) {
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const boundsKey = useMemo(() => {
    const { center, span } = boundsOf(members);
    return `${center.join(',')}|${span}`;
  }, [members]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { center, span } = boundsOf(members);
    const dist = cameraDistanceForSpan(span);
    const dir = new THREE.Vector3(1, 0.8, 1).normalize().multiplyScalar(dist);
    controls.object.position.set(
      center[0] + dir.x,
      center[1] + dir.y,
      center[2] + dir.z,
    );
    controls.target.set(...center);
    controls.update();
    // boundsKey captures everything that should retrigger the fit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey]);

  const { center, span } = boundsOf(members);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={Math.max(50, span * 0.1)}
      maxDistance={Math.max(50000, span * 50)}
      target={new THREE.Vector3(...center)}
    />
  );
}

type Props = {
  members: ExpressMember[];
  roleColors: Map<string, string>;
  sectionSizeMm: number;
};

export function ExpressScene({ members, roleColors, sectionSizeMm }: Props) {
  const { span } = boundsOf(members);

  return (
    <Canvas
      style={{ width: '100%', height: '100%', display: 'block' }}
      camera={{
        position: [1500, 1200, 1500],
        fov: 45,
        near: 1,
        far: Math.max(200000, span * 100),
      }}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => {
        gl.setClearColor('#f4f4f4');
      }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[2000, 3000, 1500]} intensity={0.7} />
      <directionalLight position={[-1500, 1000, -2000]} intensity={0.25} />
      <Grid
        cellSize={100}
        cellThickness={0.5}
        sectionSize={500}
        sectionThickness={0.9}
        fadeDistance={Math.max(4000, span * 4)}
        infiniteGrid
        cellColor="#cccccc"
        sectionColor="#999999"
      />
      {members.map((m) => (
        <MemberBox
          key={m.id}
          member={m}
          color={roleColors.get(m.role) ?? '#888888'}
          section={sectionSizeMm}
        />
      ))}
      <FitCamera members={members} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport
          axisColors={['#111', '#444', '#888']}
          labelColor="#111"
        />
      </GizmoHelper>
    </Canvas>
  );
}
