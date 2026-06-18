import { Html } from '@react-three/drei';
import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { formatLength } from '../core/units';
import { edgeLength, midpoint, roundLength } from '../core/geometry';

export function DimensionLabels() {
  const units = useSettingsStore((s) => s.units);
  const nodes = useStructureStore((s) => s.nodes);
  const edges = useStructureStore((s) => s.edges);
  const selection = useStructureStore((s) => s.selection);

  return (
    <group>
      {edges.map((edge) => {
        const from = nodes.find((n) => n.id === edge.fromId);
        const to = nodes.find((n) => n.id === edge.toId);
        if (!from || !to) return null;
        const len = roundLength(edgeLength(nodes, edge.fromId, edge.toId));
        const mid = midpoint(from.position, to.position);
        const isSelected =
          selection?.type === 'edge' && selection.id === edge.id;
        if (!isSelected && edges.length > 8) return null;
        return (
          <Html key={edge.id} position={mid} center distanceFactor={12}>
            <div
              className="dimension-label"
              style={{
                opacity: isSelected ? 1 : 0.7,
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              {formatLength(len, units)}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
