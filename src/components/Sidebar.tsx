import { useStructureStore } from '../store/structureStore';
import {
  constraintLabel,
  constraintLabelPerp,
} from '../core/constraints';
import { getConstraintEdgePair } from '../core/selection';
import { DuplicatePanel } from './DuplicatePanel';

export function Sidebar() {
  const nodes = useStructureStore((s) => s.nodes);
  const edges = useStructureStore((s) => s.edges);
  const constraints = useStructureStore((s) => s.constraints);
  const selection = useStructureStore((s) => s.selection);
  const selectedEdgeIds = useStructureStore((s) => s.selectedEdgeIds);
  const secondEdgeId = useStructureStore((s) => s.secondEdgeId);
  const setSelection = useStructureStore((s) => s.setSelection);
  const setSecondEdge = useStructureStore((s) => s.setSecondEdge);
  const setSecondNode = useStructureStore((s) => s.setSecondNode);
  const secondNodeId = useStructureStore((s) => s.secondNodeId);
  const getEdgeLength = useStructureStore((s) => s.getEdgeLength);
  const setEdgeLengthById = useStructureStore((s) => s.setEdgeLengthById);
  const getNodePairDistance = useStructureStore((s) => s.getNodePairDistance);
  const canConstrain = useStructureStore((s) => {
    const pair = getConstraintEdgePair(
      s.selection,
      s.selectedEdgeIds,
      s.secondEdgeId,
    );
    return pair !== null;
  });
  const applyConstraintParallelToPair = useStructureStore(
    (s) => s.applyConstraintParallelToPair,
  );
  const applyConstraintPerpendicularToPair = useStructureStore(
    (s) => s.applyConstraintPerpendicularToPair,
  );
  const removeConstraint = useStructureStore((s) => s.removeConstraint);

  const selectedEdge =
    selection?.type === 'edge'
      ? edges.find((e) => e.id === selection.id)
      : null;
  const edgeLen = selectedEdge ? getEdgeLength(selectedEdge.id) : 0;
  const pairDist = getNodePairDistance();
  const primaryEdgeId = selection?.type === 'edge' ? selection.id : null;
  const hasSelection =
    selection?.type === 'edge' || selectedEdgeIds.length > 0;

  return (
    <aside className="panel">
      <div className="panel-header">Structure</div>
      <div className="panel-body">
        <div className="stats-row">
          <div className="stat-card">
            <strong>Nodes</strong>
            <span>{nodes.length}</span>
          </div>
          <div className="stat-card">
            <strong>Members</strong>
            <span>{edges.length}</span>
          </div>
          <div className="stat-card">
            <strong>Constraints</strong>
            <span>{constraints.length}</span>
          </div>
        </div>

        {hasSelection && (
          <div className="section">
            <DuplicatePanel />
          </div>
        )}

        {selection?.type === 'edge' && selectedEdge && (
          <div className="section">
            <p className="section-title">Selected member</p>
            <div className="field">
              <label>Length (mm)</label>
              <input
                type="number"
                min={1}
                step={0.1}
                value={edgeLen}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (!isNaN(v) && v > 0) {
                    setEdgeLengthById(selectedEdge.id, v);
                  }
                }}
              />
            </div>
          </div>
        )}

        {hasSelection && (
          <div className="section">
            <p className="section-title">Constraints</p>
            <div className="field">
              <label>Second member</label>
              <select
                value={secondEdgeId ?? ''}
                onChange={(e) => setSecondEdge(e.target.value || null)}
              >
                <option value="">
                  {selectedEdgeIds.length >= 2
                    ? '2 members selected'
                    : 'Shift+click another…'}
                </option>
                {edges
                  .filter((e) => e.id !== primaryEdgeId)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      M{edges.indexOf(e) + 1} — {getEdgeLength(e.id)} mm
                    </option>
                  ))}
              </select>
            </div>
            <div className="constraint-actions">
              <button
                type="button"
                className="primary"
                disabled={!canConstrain}
                onClick={applyConstraintParallelToPair}
              >
                ∥ Parallel
              </button>
              <button
                type="button"
                disabled={!canConstrain}
                onClick={applyConstraintPerpendicularToPair}
              >
                ⊥ Perp
              </button>
            </div>
          </div>
        )}

        {constraints.length > 0 && (
          <div className="section">
            <p className="section-title">Active</p>
            {constraints.map((c) => (
              <div key={c.id} className="constraint-item">
                <span>
                  {c.type === 'parallel'
                    ? constraintLabel(c, edges)
                    : constraintLabelPerp(c, edges)}
                </span>
                <button
                  type="button"
                  onClick={() => removeConstraint(c.id)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {selection?.type === 'node' && (
          <div className="section">
            <p className="section-title">Node</p>
            <div className="field">
              <label>Compare distance to</label>
              <select
                value={secondNodeId ?? ''}
                onChange={(e) => setSecondNode(e.target.value || null)}
              >
                <option value="">Select node…</option>
                {nodes
                  .filter((n) => n.id !== selection.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      ({n.position.map((v) => Math.round(v)).join(', ')})
                    </option>
                  ))}
              </select>
            </div>
            {pairDist != null && (
              <div className="stat-card" style={{ marginTop: 8 }}>
                <strong>Distance</strong>
                <span>{pairDist} mm</span>
              </div>
            )}
          </div>
        )}

        <div className="section">
          <p className="section-title">Members</p>
          <div className="list-scroll">
            {edges.length === 0 ? (
              <div className="list-item" style={{ cursor: 'default', opacity: 0.6 }}>
                No members yet
              </div>
            ) : (
              edges.map((e, i) => (
                <div
                  key={e.id}
                  className={`list-item ${
                    selectedEdgeIds.includes(e.id) || secondEdgeId === e.id
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => setSelection({ type: 'edge', id: e.id })}
                >
                  M{i + 1} · {getEdgeLength(e.id)} mm
                </div>
              ))
            )}
          </div>
        </div>

        {nodes.length > 0 && (
          <div className="section">
            <p className="section-title">Nodes</p>
            <div className="list-scroll">
              {nodes.map((n) => (
                <div
                  key={n.id}
                  className={`list-item ${
                    selection?.type === 'node' && selection.id === n.id
                      ? 'selected'
                      : ''
                  }`}
                  onClick={() => setSelection({ type: 'node', id: n.id })}
                >
                  {n.position.map((v) => Math.round(v)).join(', ')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
