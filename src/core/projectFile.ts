import type {
  EdgeConstraint,
  Node,
  Profile,
  StockBar,
  Vec3,
  WorkPlane,
} from './types';

/**
 * On-disk project format. Saved as a .json file on the user's computer via the
 * File System Access API (with a download/upload fallback for unsupported browsers).
 */

export type StructurePayload = {
  nodes: Node[];
  edges: { id: string; fromId: string; toId: string }[];
  constraints: EdgeConstraint[];
  profile: Profile;
  stock: StockBar[];
  kerf: number;
  snap: number;
  gridCellSize: number;
  snapToGrid: boolean;
  workPlane: WorkPlane;
  duplicateOffset: Vec3;
};

export type ExpressPayload = {
  templateId: string;
  paramsByTemplate: Record<string, Record<string, number>>;
  stockMode: 'buy' | 'inventory';
  buyLength: number;
  inventory: StockBar[];
  kerf: number;
  profileName: string;
  sectionSizeMm: number;
  /** Joint type id; optional for projects saved before joints existed. */
  jointId?: string;
  /** Through-member continuity option index; optional for older projects. */
  throughIndex?: number;
};

export type ProjectFile = {
  app: 'profile-builder';
  version: 1;
  kind: 'structure' | 'express';
  savedAt: string;
  name: string;
  structure?: StructurePayload;
  express?: ExpressPayload;
};

const FILE_TYPES = [
  {
    description: 'Profile Builder project',
    accept: { 'application/json': ['.json'] as string[] },
  },
];

function supportsFsAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

function sanitizeName(name: string): string {
  const base = name.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return base || 'project';
}

export function suggestedFileName(name: string): string {
  const base = sanitizeName(name);
  return base.endsWith('.json') ? base : `${base}.json`;
}

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function openViaInput(): Promise<ProjectFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        resolve(parseProjectFile(await file.text()));
      } catch (err) {
        resolve(Promise.reject(err));
      }
    };
    // If the dialog is dismissed there is no reliable cancel event; the promise
    // simply never resolves, which is harmless — the caller is awaiting a click.
    input.click();
  });
}

export type SaveOutcome = 'saved' | 'cancelled';

export async function saveProjectFile(
  project: ProjectFile,
  fileName: string,
): Promise<SaveOutcome> {
  const text = JSON.stringify(project, null, 2);

  if (supportsFsAccess()) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<{
            createWritable: () => Promise<{
              write: (data: string) => Promise<void>;
              close: () => Promise<void>;
            }>;
          }>;
        }
      ).showSaveFilePicker({ suggestedName: fileName, types: FILE_TYPES });
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      return 'saved';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled';
      }
      // Permission/security errors → fall back to a plain download.
    }
  }

  downloadText(fileName, text);
  return 'saved';
}

export async function openProjectFile(): Promise<ProjectFile | null> {
  if (supportsFsAccess() && 'showOpenFilePicker' in window) {
    try {
      const [handle] = await (
        window as unknown as {
          showOpenFilePicker: (opts: unknown) => Promise<
            { getFile: () => Promise<File> }[]
          >;
        }
      ).showOpenFilePicker({ types: FILE_TYPES, multiple: false });
      const file = await handle.getFile();
      return parseProjectFile(await file.text());
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return null;
      }
      // Other failures → fall back to the input element.
    }
  }

  return openViaInput();
}

export function parseProjectFile(text: string): ProjectFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const obj = data as Partial<ProjectFile>;
  if (!obj || obj.app !== 'profile-builder') {
    throw new Error('This file is not a Profile Builder project.');
  }
  if (obj.kind === 'structure' && !obj.structure) {
    throw new Error('Project file is missing its structure data.');
  }
  if (obj.kind === 'express' && !obj.express) {
    throw new Error('Project file is missing its Express data.');
  }
  if (obj.kind !== 'structure' && obj.kind !== 'express') {
    throw new Error('Unknown project type.');
  }
  return obj as ProjectFile;
}
