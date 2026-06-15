import { useStructureStore } from '../store/structureStore';

const PLANE_CONFIG = {
  xz: { rot: [-Math.PI / 2, 0, 0] as [number, number, number], pos: [50, 0, 25] as [number, number, number] },
  xy: { rot: [0, 0, 0] as [number, number, number], pos: [50, 25, 0] as [number, number, number] },
  yz: { rot: [0, Math.PI / 2, 0] as [number, number, number], pos: [0, 25, 25] as [number, number, number] },
};

export function WorkPlaneVisual() {
  const workPlane = useStructureStore((s) => s.workPlane);
  if (workPlane === 'free') return null;
  const cfg = PLANE_CONFIG[workPlane];
  return (
    <mesh rotation={cfg.rot} position={cfg.pos}>
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial color="#e8e8e8" transparent opacity={0.35} side={2} />
    </mesh>
  );
}
