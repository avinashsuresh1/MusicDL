import { invoke } from '@tauri-apps/api/core';

let tauriPath: string | null = null;

function isTauri(): boolean {
  return typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
}

/**
 * Open a project directory, recursively reading composition.yaml, instruments/, melodies/, and tracks/.
 * Returns a record of relative paths to file contents.
 */
export async function openProjectDirectory(): Promise<Record<string, string>> {
  if (!isTauri()) {
    throw new DOMException('Not running in Tauri environment', 'AbortError');
  }
  try {
    const result = await invoke<{ path: string, files: Record<string, string> } | null>('open_project_directory');
    if (result) {
      tauriPath = result.path;
      return result.files;
    } else {
      throw new DOMException('User aborted folder selection', 'AbortError');
    }
  } catch (err: any) {
    console.error('Tauri open folder failed:', err);
    throw err;
  }
}

/**
 * Save a record of file paths and contents back to the opened project directory.
 */
export async function saveProjectDirectory(files: Record<string, string>): Promise<void> {
  if (!isTauri()) return;
  if (!tauriPath) {
    const result = await invoke<{ path: string, files: Record<string, string> } | null>('open_project_directory');
    if (result) {
      tauriPath = result.path;
    } else {
      throw new Error('Save aborted: No folder selected.');
    }
  }
  await invoke('save_project_directory', { path: tauriPath, files });
}

/**
 * Checks if the store has a directory handle loaded.
 */
export function hasDirectoryHandle(): boolean {
  return tauriPath !== null;
}

export function getTauriPath(): string | null {
  return tauriPath;
}

export function setTauriPath(path: string | null) {
  tauriPath = path;
}

export async function renameProjectFile(oldRel: string, newRel: string): Promise<void> {
  if (!isTauri()) return;
  if (tauriPath) {
    await invoke('rename_file', { path: tauriPath, oldRel, newRel });
  }
}

export async function deleteProjectFile(relPath: string): Promise<void> {
  if (!isTauri()) return;
  if (tauriPath) {
    await invoke('delete_file', { path: tauriPath, relPath });
  }
}

export async function createNewProjectDirectory(defaultFiles: Record<string, string>): Promise<{ path: string, files: Record<string, string> } | null> {
  if (!isTauri()) return null;
  try {
    const result = await invoke<{ path: string, files: Record<string, string> } | null>('create_new_project_directory', { defaultFiles });
    if (result) {
      tauriPath = result.path;
      return result;
    }
    return null;
  } catch (err: any) {
    console.error('Tauri create project failed:', err);
    throw err;
  }
}
