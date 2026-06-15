import * as THREE from 'three';
import type { Vec3, WorkPlane } from './types';

export function workPlaneNormal(plane: WorkPlane): THREE.Vector3 {
  switch (plane) {
    case 'xy':
      return new THREE.Vector3(0, 0, 1);
    case 'yz':
      return new THREE.Vector3(1, 0, 0);
    case 'xz':
    default:
      return new THREE.Vector3(0, 1, 0);
  }
}

export function makeWorkPlane(plane: WorkPlane, through: Vec3): THREE.Plane {
  const normal = workPlaneNormal(plane);
  const point = new THREE.Vector3(...through);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
}

export function makeCameraPlane(
  camera: THREE.Camera,
  through: Vec3,
): THREE.Plane {
  const normal = new THREE.Vector3();
  camera.getWorldDirection(normal);
  const point = new THREE.Vector3(...through);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
}

export function raycastToPlane(
  raycaster: THREE.Raycaster,
  plane: THREE.Plane,
  target: THREE.Vector3,
): boolean {
  return raycaster.ray.intersectPlane(plane, target) !== null;
}

export function applyAxisLock(
  origin: Vec3,
  candidate: Vec3,
  axis: 'x' | 'y' | 'z',
): Vec3 {
  if (axis === 'x') return [candidate[0], origin[1], origin[2]];
  if (axis === 'y') return [origin[0], candidate[1], origin[2]];
  return [origin[0], origin[1], candidate[2]];
}

export const WORK_PLANE_LABELS: Record<WorkPlane, string> = {
  xz: 'XZ (floor)',
  xy: 'XY (front)',
  yz: 'YZ (side)',
  free: '3D (camera)',
};
