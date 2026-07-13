import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectStore } from '../src/state/store.js';

describe('store-mutations', () => {
  let store: ProjectStore;
  const baseValidFiles: Record<string, string> = {
    'composition.yaml': `
title: "Test Composition"
tempo: 100
root_frequency: 440.0
interval: 100
`,
    'instruments/synth.yaml': `
harmonics:
  - { z: 1, amplitude: 1.0 }
`,
    'melodies/lead.yaml': `
type: melody
instrument: synth
notes:
  - { pitch: 0, offset: 0, duration: 1 }
`,
    'tracks/melody_track.yaml': `
volume: 0.9
melodies:
  - lead
`
  };

  beforeEach(() => {
    store = new ProjectStore();
    store.loadProject(baseValidFiles);
  });

  it('should rename a file in memory and re-parse successfully', async () => {
    expect(store.getFiles()['melodies/lead.yaml']).toBeDefined();
    expect(store.getFiles()['melodies/theme.yaml']).toBeUndefined();

    // Rename file
    await store.renameFile('melodies/lead.yaml', 'melodies/theme.yaml');
    
    // Fix track reference to match rename
    store.updateFile('tracks/melody_track.yaml', `
volume: 0.9
melodies:
  - theme
`);

    expect(store.getFiles()['melodies/lead.yaml']).toBeUndefined();
    expect(store.getFiles()['melodies/theme.yaml']).toBeDefined();
    
    // Check that composition.melodies has updated keys
    expect(store.getComposition()?.melodies['theme']).toBeDefined();
    expect(store.getComposition()?.melodies['lead']).toBeUndefined();
  });

  it('should delete a file in memory and re-parse successfully', async () => {
    expect(store.getFiles()['melodies/lead.yaml']).toBeDefined();

    // Delete file
    await store.deleteFile('melodies/lead.yaml');
    
    // Clear track melodies reference to make project valid again
    store.updateFile('tracks/melody_track.yaml', `
volume: 0.9
melodies: []
`);

    expect(store.getFiles()['melodies/lead.yaml']).toBeUndefined();
    expect(store.getComposition()?.melodies['lead']).toBeUndefined();
  });

  it('should add a file in memory and re-parse successfully', async () => {
    expect(store.getFiles()['instruments/piano.yaml']).toBeUndefined();

    await store.addFile('instruments', 'piano');

    expect(store.getFiles()['instruments/piano.yaml']).toBeDefined();
    expect(store.getFiles()['instruments/piano.yaml']).toContain('harmonics:');
    expect(store.getComposition()?.instruments['piano']).toBeDefined();
  });
});
