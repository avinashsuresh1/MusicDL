import { invoke } from '@tauri-apps/api/core';

let tauriPath: string | null = null;

/**
 * Open a project directory, recursively reading composition.yaml, instruments/, melodies/, and tracks/.
 * Returns a record of relative paths to file contents.
 */
export async function openProjectDirectory(): Promise<Record<string, string>> {
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
