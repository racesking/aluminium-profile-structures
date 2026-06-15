import { useStructureStore } from './structureStore';
import { useExpressStore } from './expressStore';
import { useAppStore } from './appStore';
import {
  openProjectFile,
  saveProjectFile,
  suggestedFileName,
  type ProjectFile,
  type SaveOutcome,
} from '../core/projectFile';

function timestamp(): string {
  return new Date().toISOString();
}

/** Save the Advanced builder's current structure to a file on disk. */
export async function saveStructureProject(name = 'structure'): Promise<SaveOutcome> {
  const project: ProjectFile = {
    app: 'profile-builder',
    version: 1,
    kind: 'structure',
    savedAt: timestamp(),
    name,
    structure: useStructureStore.getState().getStructurePayload(),
  };
  return saveProjectFile(project, suggestedFileName(name));
}

/** Save the Express builder's parametric configuration to a file on disk. */
export async function saveExpressProject(name = 'express-design'): Promise<SaveOutcome> {
  const project: ProjectFile = {
    app: 'profile-builder',
    version: 1,
    kind: 'express',
    savedAt: timestamp(),
    name,
    express: useExpressStore.getState().getExpressPayload(),
  };
  return saveProjectFile(project, suggestedFileName(name));
}

export type OpenResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'opened'; kind: ProjectFile['kind']; name: string };

/**
 * Open a project file from disk, hydrate the matching store, and route to the
 * right builder view. Returns a structured result for the caller to surface.
 */
export async function openProjectAndRoute(): Promise<OpenResult> {
  let project: ProjectFile | null;
  try {
    project = await openProjectFile();
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Could not open the file.',
    };
  }
  if (!project) return { status: 'cancelled' };

  if (project.kind === 'express' && project.express) {
    useExpressStore.getState().hydrateFromPayload(project.express);
    useAppStore.getState().setView('express');
  } else if (project.kind === 'structure' && project.structure) {
    useStructureStore.getState().hydrateFromPayload(project.structure);
    useAppStore.getState().setView('advanced');
  } else {
    return { status: 'error', message: 'Project file is incomplete.' };
  }

  return { status: 'opened', kind: project.kind, name: project.name };
}
