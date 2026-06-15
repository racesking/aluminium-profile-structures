import type {
  EdgeConstraint,
  Node,
  Profile,
  StockBar,
  Vec3,
  WorkPlane,
} from './types';
import type { ProfileDef, ProfileStock } from './profiles';
import { z } from 'zod';

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
  kerf: number;
  /** Joint type id; optional for projects saved before joints existed. */
  jointId?: string;
  /** Through-member continuity option index; optional for older projects. */
  throughIndex?: number;
  /** Global stock mode. */
  stockMode?: 'buy' | 'inventory';

  /* ---- multi-profile (v2) ---- */
  profiles?: ProfileDef[];
  /** Per-template role → profile id assignment. */
  roleProfileByTemplate?: Record<string, Record<string, string>>;
  /** Per-profile stock (keyed by profile id). */
  stockByProfile?: Record<string, ProfileStock>;

  /* ---- legacy single-profile (v1), read for migration ---- */
  profileName?: string;
  sectionSizeMm?: number;
  buyLength?: number;
  inventory?: StockBar[];
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

/* ---- Runtime validation — defends against malformed or hostile files ---- */

const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
const StockBarSchema = z.object({
  id: z.string(),
  length: z.number(),
  quantity: z.number(),
});
const NodeSchema = z.object({ id: z.string(), position: Vec3Schema });
const EdgeSchema = z.object({ id: z.string(), fromId: z.string(), toId: z.string() });
const ConstraintSchema = z.object({
  id: z.string(),
  edgeAId: z.string(),
  edgeBId: z.string(),
  type: z.enum(['parallel', 'perpendicular']),
});
const ProfileSchema = z.object({
  name: z.string(),
  sectionLabel: z.string().optional(),
  sectionSizeMm: z.number().optional(),
});

const StructurePayloadSchema = z
  .object({
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
    constraints: z.array(ConstraintSchema),
    profile: ProfileSchema,
    stock: z.array(StockBarSchema),
    kerf: z.number(),
    snap: z.number(),
    gridCellSize: z.number(),
    snapToGrid: z.boolean(),
    workPlane: z.enum(['xz', 'xy', 'yz', 'free']),
    duplicateOffset: Vec3Schema,
  })
  .passthrough();

const ProfileDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  sectionMm: z.number(),
});
const ProfileStockSchema = z.object({
  buyLength: z.number(),
  inventory: z.array(StockBarSchema),
});

const ExpressPayloadSchema = z
  .object({
    templateId: z.string(),
    paramsByTemplate: z.record(z.record(z.number())),
    kerf: z.number(),
    jointId: z.string().optional(),
    throughIndex: z.number().optional(),
    stockMode: z.enum(['buy', 'inventory']).optional(),
    profiles: z.array(ProfileDefSchema).optional(),
    roleProfileByTemplate: z.record(z.record(z.string())).optional(),
    stockByProfile: z.record(ProfileStockSchema).optional(),
    // legacy v1 fields
    profileName: z.string().optional(),
    sectionSizeMm: z.number().optional(),
    buyLength: z.number().optional(),
    inventory: z.array(StockBarSchema).optional(),
  })
  .passthrough();

const ProjectFileSchema = z
  .object({
    app: z.literal('profile-builder'),
    version: z.number(),
    kind: z.enum(['structure', 'express']),
    savedAt: z.string(),
    name: z.string(),
    structure: StructurePayloadSchema.optional(),
    express: ExpressPayloadSchema.optional(),
  })
  .passthrough();

export function parseProjectFile(text: string): ProjectFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  // Friendly message for a file that isn't ours at all, before schema details.
  if (
    !data ||
    typeof data !== 'object' ||
    (data as { app?: unknown }).app !== 'profile-builder'
  ) {
    throw new Error('This file is not a Profile Builder project.');
  }

  const parsed = ProjectFileSchema.safeParse(data);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` (at ${first.path.join('.')})` : '';
    throw new Error(`This project file is malformed or unsupported${where}.`);
  }

  // The schema guarantees the shape; the payload for the declared kind must exist.
  const project = data as ProjectFile;
  if (project.kind === 'structure' && !project.structure) {
    throw new Error('Project file is missing its structure data.');
  }
  if (project.kind === 'express' && !project.express) {
    throw new Error('Project file is missing its Express data.');
  }
  return project;
}
