import { describe, it, expect } from 'vitest';
import { parseProject } from '../src/parser/yaml-parser.js';
import { validateComposition } from '../src/parser/validator.js';
import * as fs from 'fs';
import * as path from 'path';

function getProjectFiles(dir: string, baseDir: string = dir): Record<string, string> {
  let results: Record<string, string> = {};
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = { ...results, ...getProjectFiles(fullPath, baseDir) };
    } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results[relPath] = fs.readFileSync(fullPath, 'utf8');
    }
  });
  return results;
}

describe('grandfather-clock project validation', () => {
  it('should parse and validate the grandfather-clock project successfully', () => {
    const projectPath = path.resolve(__dirname, '../examples/grandfather-clock');
    const files = getProjectFiles(projectPath);
    expect(Object.keys(files).length).toBeGreaterThan(0);

    const comp = parseProject(files);
    const result = validateComposition(comp);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });
});
