let dirHandle: any = null;

/**
 * Open a project directory, recursively reading composition.yaml, instruments/, melodies/, and tracks/.
 * Returns a record of relative paths to file contents.
 */
export async function openProjectDirectory(): Promise<Record<string, string>> {
  if (typeof (window as any).showDirectoryPicker === 'function') {
    try {
      dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
      
      const files: Record<string, string> = {};
      await readDirectoryRecursively(dirHandle, '', files);
      return files;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err;
      }
      console.warn('showDirectoryPicker failed, falling back to input:', err);
    }
  }

  // Fallback: Use <input type="file" webkitdirectory directory multiple>
  return new Promise<Record<string, string>>((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.multiple = true;

    input.addEventListener('change', async () => {
      const filesList = input.files;
      if (!filesList || filesList.length === 0) {
        reject(new DOMException('User aborted folder selection', 'AbortError'));
        return;
      }

      const files: Record<string, string> = {};
      const promises: Promise<void>[] = [];

      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        
        // Strip the root folder name from webkitRelativePath
        const parts = file.webkitRelativePath.split('/');
        parts.shift(); // Remove top folder name
        const relativePath = parts.join('/');

        if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
          promises.push((async () => {
            const text = await file.text();
            files[relativePath] = text;
          })());
        }
      }

      try {
        await Promise.all(promises);
        resolve(files);
      } catch (err) {
        reject(err);
      }
    });

    input.addEventListener('cancel', () => {
      reject(new DOMException('User aborted folder selection', 'AbortError'));
    });

    input.click();
  });
}

/**
 * Save a record of file paths and contents back to the opened project directory.
 */
export async function saveProjectDirectory(files: Record<string, string>): Promise<void> {
  if (!dirHandle) {
    if (typeof (window as any).showDirectoryPicker === 'function') {
      dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite'
      });
    } else {
      throw new Error(
        'Directly saving back to a local folder is not supported in this browser/context. ' +
        'Please use Chrome, Edge, or Opera in a secure context (like localhost) to use folder save features, ' +
        'or copy your edits directly from the editor.'
      );
    }
  }

  for (const [path, content] of Object.entries(files)) {
    const parts = path.split('/');
    let currentDir = dirHandle;
    
    // Traverse and create subdirectories as needed
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
    }
    
    // Write file content
    const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1], { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }
}

/**
 * Checks if the store has a directory handle loaded.
 */
export function hasDirectoryHandle(): boolean {
  return dirHandle !== null;
}

/**
 * Helper to recursively scan directory entries.
 */
async function readDirectoryRecursively(
  directory: any,
  currentPath: string,
  files: Record<string, string>
): Promise<void> {
  for await (const entry of directory.values()) {
    const relativePath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
    
    if (entry.kind === 'file') {
      if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
        const file = await (entry as any).getFile();
        const text = await file.text();
        files[relativePath] = text;
      }
    } else if (entry.kind === 'directory') {
      await readDirectoryRecursively(entry, relativePath, files);
    }
  }
}
