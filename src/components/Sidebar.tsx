import { useId } from 'react';
import { useStructureStore } from '../store/structureStore';
import { useSettingsStore } from '../store/settingsStore';
import { toDisplay, fromDisplay, formatLength, unitInputStep } from '../core/units';
import { getConstraintEdgePair } from '../core/selection';
import { sectionLabel } from '../core/profileShapes';
import type { ProfileDef } from '../core/profiles';
import { DuplicatePanel } from './DuplicatePanel';
import { CommitNumberInput } from './CommitNumberInput';
import { LockIcon } from './LockIcon';
import { useCutPlan } from './useCutPlan';

export function Sidebar() {
  const units = useSettingsStore((s) => s.units);
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
  const lockedEdgeIds = useStructureStore((s) => s.lockedEdgeIds);
  const getEdgeLength = useStructureStore((s) => s.getEdgeLength);
  const setEdgeLengthById = useStructureStore((s) => s.setEdgeLengthById);
  const getNodePairDistance = useStructureStore((s) => s.getNodePairDistance);
  const canConstrain = useStructureStore(
    (s) => getConstraintEdgePair(s.selection, s.selectedEdgeIds, s.secondEdgeId) !== null,
  );
  const applyConstraintParallelToPair = useStructureStore(
    (s) => s.applyConstraintParallelToPair,
  );
  const applyConstraintPerpendicularToPair = useStructureStore(
    (s) => s.applyConstraintPerpendicularToPair,
  );
  const removeConstraint = useStructureStore((s) => s.removeConstraint);

  const plan = useCutPlan();
  const ids = useId();
  const labelOf = (edgeId: string) => plan.parts.get(edgeId)?.label ?? '—';
  const partCount = new Set([...plan.parts.values()].map((p) => p.part)).size;

  const selectedEdge =
    selection?.type === 'edge' ? edges.find((e) => e.id === selection.id) : null;
  const primaryEdgeId = selection?.type === 'edge' ? selection.id : null;
  const hasSelection = selection?.type === 'edge' || selectedEdgeIds.length > 0;
  const pairDist = getNodePairDistance();

  // Members listed by part (A1, A2, B1 …) — the order a cut list is read in.
  const members = edges
    .map((e) => ({ edge: e, info: plan.parts.get(e.id) }))
    .sort((a, b) =>
      (a.info?.label ?? '').localeCompare(b.info?.label ?? '', 'en', { numeric: true }),
    );

  return (
    <aside className="panel" aria-label="Structure">
      <div className="panel-header">Structure</div>
      <div className="panel-body">
        <div className="stats-row">
          <div className="stat-card">
            <strong>Members</strong>
            <span>{edges.length}</span>
          </div>
          <div className="stat-card">
            <strong>Parts</strong>
            <span>{partCount}</span>
          </div>
          <div className="stat-card">
            <strong>Total cut</strong>
            <span>{formatLength(plan.totalCut, units)}</span>
          </div>
        </div>

        {selectedEdge && (
          <MemberInspector
            edgeId={selectedEdge.id}
            label={labelOf(selectedEdge.id)}
            centreline={getEdgeLength(selectedEdge.id)}
            cutLength={plan.cutLengths.get(selectedEdge.id)}
            profile={plan.profileOf(selectedEdge.id)}
            locked={lockedEdgeIds.includes(selectedEdge.id)}
            extraSelected={Math.max(0, selectedEdgeIds.length - 1)}
            onLength={(mm) => setEdgeLengthById(selectedEdge.id, mm)}
          />
        )}

        {hasSelection && (
          <details className="section disclosure">
            <summary className="section-title">Move / duplicate</summary>
            <DuplicatePanel />
          </details>
        )}

        {(hasSelection || constraints.length > 0) && (
          <details className="section disclosure" open={constraints.length > 0}>
            <summary className="section-title">
              Constraints{constraints.length > 0 ? ` (${constraints.length})` : ''}
            </summary>
            {hasSelection && (
              <>
                <div className="field">
                  <label htmlFor={`${ids}-second`}>Align against</label>
                  <select
                    id={`${ids}-second`}
                    value={secondEdgeId ?? ''}
                    onChange={(e) => setSecondEdge(e.target.value || null)}
                  >
                    <option value="">
                      {selectedEdgeIds.length >= 2
                        ? 'The other selected member'
                        : 'Shift+click a second member…'}
                    </option>
                    {members
                      .filter(({ edge }) => edge.id !== primaryEdgeId)
                      .map(({ edge }) => (
                        <option key={edge.id} value={edge.id}>
                          {labelOf(edge.id)} — {formatLength(plan.cutLengths.get(edge.id) ?? 0, units)}
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
                    ⊥ Perpendicular
                  </button>
                </div>
              </>
            )}
            {constraints.map((c) => {
              const text = `${labelOf(c.edgeAId)} ${c.type === 'parallel' ? '∥' : '⊥'} ${labelOf(c.edgeBId)}`;
              return (
                <div key={c.id} className="constraint-item">
                  <span>{text}</span>
                  <button
                    type="button"
                    onClick={() => removeConstraint(c.id)}
                    aria-label={`Remove constraint ${text}`}
                    title="Remove constraint"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </details>
        )}

        {selection?.type === 'node' && (
          <div className="section">
            <p className="section-title">Node</p>
            <div className="field">
              <label htmlFor={`${ids}-node`}>Measure distance to</label>
              <select
                id={`${ids}-node`}
                value={secondNodeId ?? ''}
                onChange={(e) => setSecondNode(e.target.value || null)}
              >
                <option value="">Select node…</option>
                {nodes
                  .filter((n) => n.id !== selection.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      ({n.position.map((v) => toDisplay(v, units)).join(', ')})
                    </option>
                  ))}
              </select>
            </div>
            {pairDist != null && (
              <div className="stat-card" style={{ marginTop: 8 }}>
                <strong>Distance</strong>
                <span>{formatLength(pairDist, units)}</span>
              </div>
            )}
          </div>
        )}

        <div className="section">
          <p className="section-title" id={`${ids}-members`}>
            Members
          </p>
          {edges.length === 0 ? (
            <p className="hint hint-compact" style={{ marginTop: 0 }}>
              No members yet. Start from a box frame, or place nodes (N) and
              connect them (C).
            </p>
          ) : (
            <ul className="list-scroll" aria-labelledby={`${ids}-members`}>
              {members.map(({ edge }) => {
                const selected =
                  selectedEdgeIds.includes(edge.id) || secondEdgeId === edge.id;
                const locked = lockedEdgeIds.includes(edge.id);
                return (
                  <li key={edge.id}>
                    <button
                      type="button"
                      className={`list-item ${selected ? 'selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setSelection({ type: 'edge', id: edge.id })}
                    >
                      <span className="list-item-id">{labelOf(edge.id)}</span>
                      <span>{formatLength(plan.cutLengths.get(edge.id) ?? 0, units)}</span>
                      {locked && <LockIcon title="Locked" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {nodes.length > 0 && (
          <details className="section disclosure">
            <summary className="section-title">Nodes ({nodes.length})</summary>
            <ul className="list-scroll">
              {nodes.map((n) => {
                const selected = selection?.type === 'node' && selection.id === n.id;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`list-item ${selected ? 'selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => setSelection({ type: 'node', id: n.id })}
                    >
                      {n.position.map((v) => toDisplay(v, units)).join(', ')}
                    </button>
                  </li>
                );
              })}
            </ul>
          </details>
        )}
      </div>
    </aside>
  );
}

/** What the user edits most: the selected member's length, part and profile. */
function MemberInspector({
  edgeId,
  label,
  centreline,
  cutLength,
  profile,
  locked,
  extraSelected,
  onLength,
}: {
  edgeId: string;
  label: string;
  centreline: number;
  cutLength: number | undefined;
  profile: ProfileDef;
  locked: boolean;
  extraSelected: number;
  onLength: (mm: number) => void;
}) {
  const units = useSettingsStore((s) => s.units);
  const id = useId();
  return (
    <div className="section inspector" key={edgeId}>
      <p className="section-title">
        Member {label}
        {extraSelected > 0 && (
          <span className="inspector-more"> + {extraSelected} more selected</span>
        )}
      </p>
      <div className="field">
        <label htmlFor={id}>Centreline length ({units})</label>
        <CommitNumberInput
          id={id}
          min={0}
          step={unitInputStep(units)}
          value={toDisplay(centreline, units)}
          disabled={locked}
          onCommit={(v) => {
            if (v > 0) onLength(fromDisplay(v, units));
          }}
        />
      </div>
      <dl className="inspector-facts">
        <dt>Cut length</dt>
        <dd>{cutLength !== undefined ? formatLength(cutLength, units) : '—'}</dd>
        <dt>Profile</dt>
        <dd>
          {profile.name} · {sectionLabel(profile)}
        </dd>
        {locked && (
          <>
            <dt>Status</dt>
            <dd>
              <LockIcon /> Locked
            </dd>
          </>
        )}
      </dl>
    </div>
  );
}
