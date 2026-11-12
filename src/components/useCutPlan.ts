import { useMemo } from 'react';
import { useStructureStore } from '../store/structureStore';
import { planStructureCuts, type StructureCutPlan } from '../core/structureCuts';

/**
 * The live, joint-compensated cut plan for the Advanced structure — the same
 * numbers the 3D view, panels and drawing use. Recomputed whenever geometry,
 * profiles, stock, kerf or joint type change, so it can never go stale (the
 * Express builder works the same way).
 */
export function useCutPlan(): StructureCutPlan {
  const nodes = useStructureStore((s) => s.nodes);
  const edges = useStructureStore((s) => s.edges);
  const profiles = useStructureStore((s) => s.profiles);
  const edgeProfile = useStructureStore((s) => s.edgeProfile);
  const stockByProfile = useStructureStore((s) => s.stockByProfile);
  const kerf = useStructureStore((s) => s.kerf);
  const jointId = useStructureStore((s) => s.jointId);

  return useMemo(
    () =>
      planStructureCuts({
        nodes,
        edges,
        profiles,
        edgeProfile,
        stockByProfile,
        kerf,
        jointId,
      }),
    [nodes, edges, profiles, edgeProfile, stockByProfile, kerf, jointId],
  );
}
