import { useCallback, useEffect, useState } from 'react';
import { useStructureStore } from '../store/structureStore';
import {
  getExpressProjectId,
  renameProject,
  restoreVersion,
  saveCheckpoint,
} from '../store/autosave';
import {
  getProject,
  listVersions,
  relativeTime,
  type ProjectKind,
  type ProjectMeta,
  type VersionRecord,
} from '../core/versionStore';

type Props = {
  open: boolean;
  onClose: () => void;
  kind: ProjectKind;
};

type LoadedHistory = {
  meta: ProjectMeta | null;
  rows: { version: VersionRecord; when: string }[];
};

/** Pure fetch of a project's history — state updates happen in callbacks. */
async function loadHistory(projectId: string | null): Promise<LoadedHistory> {
  const [meta, versions] = projectId
    ? await Promise.all([getProject(projectId), listVersions(projectId)])
    : [null, [] as VersionRecord[]];
  const now = Date.now();
  return {
    meta,
    rows: versions.map((version) => ({
      version,
      when: relativeTime(version.savedAt, now),
    })),
  };
}

/** Fusion-style version history: autosaves + named checkpoints, restorable. */
export function HistoryPanel({ open, onClose, kind }: Props) {
  const structureProjectId = useStructureStore((s) => s.projectId);
  const [data, setData] = useState<LoadedHistory | null>(null);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const projectId =
    kind === 'structure' ? structureProjectId : getExpressProjectId();

  const reload = useCallback(async () => {
    setData(await loadHistory(projectId));
  }, [projectId]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadHistory(projectId).then((loaded) => {
      if (!cancelled) setData(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  if (!open) return null;

  const handleCheckpoint = async () => {
    setBusy(true);
    try {
      await saveCheckpoint(kind, label.trim() || undefined);
      setLabel('');
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const handleRestore = async (version: VersionRecord) => {
    setBusy(true);
    try {
      await restoreVersion(version);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const meta = data?.meta ?? null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal history-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Version history</h2>

        {meta && (
          <div className="field">
            <label>Project name</label>
            <input
              type="text"
              defaultValue={meta.name}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== meta.name) {
                  void renameProject(meta, e.target.value).then(reload);
                }
              }}
            />
          </div>
        )}

        <div className="history-checkpoint">
          <input
            type="text"
            placeholder="Checkpoint name (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void handleCheckpoint()}
          >
            Save version
          </button>
        </div>

        <div className="history-list">
          {data === null ? (
            <p className="hint">Loading…</p>
          ) : data.rows.length === 0 ? (
            <p className="hint">
              No versions yet — they appear as you work (autosave) or when you
              save a version.
            </p>
          ) : (
            data.rows.map(({ version, when }) => (
              <div key={version.id} className="history-row">
                <span
                  className={`history-badge ${
                    version.auto && !version.label ? 'auto' : 'manual'
                  }`}
                >
                  {version.label || (version.auto ? 'Autosave' : 'Checkpoint')}
                </span>
                <span className="history-time" title={version.savedAt}>
                  {when}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleRestore(version)}
                >
                  Restore
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
