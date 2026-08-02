import fs from 'node:fs';
import path from 'node:path';

// Find project root regardless of whether script is executed from root or src-tauri
const cwd = process.cwd();
const rootDir = cwd.endsWith('src-tauri') ? path.dirname(cwd) : cwd;
const bundleDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle');

if (fs.existsSync(bundleDir)) {
  try {
    fs.rmSync(bundleDir, { recursive: true, force: true });
    console.log('🧹 Cleaned previous release bundle directory');
  } catch (err) {
    console.warn('⚠️ Could not clean bundle directory:', err.message);
  }
}
