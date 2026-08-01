import { execSync } from 'node:child_process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

// Only run on Linux
if (os.platform() !== 'linux') {
  process.exit(0);
}

console.log('📦 Linux detected: Packaging AppImage from compiled Tauri .deb package...');

const debDir = path.join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'deb');
if (!fs.existsSync(debDir)) {
  console.log('⚠️ .deb bundle directory not found, skipping AppImage generation.');
  process.exit(0);
}

const files = fs.readdirSync(debDir);
const debFile = files.find(f => f.endsWith('.deb'));
if (!debFile) {
  console.log('⚠️ .deb package not found, skipping AppImage generation.');
  process.exit(0);
}

const debPath = path.join(debDir, debFile);
const appDir = path.join(process.cwd(), 'AppDir');

try {
  execSync(`rm -rf "${appDir}" && mkdir -p "${appDir}" && dpkg-deb -x "${debPath}" "${appDir}/"`, { stdio: 'inherit' });

  // Copy desktop file and icons into AppDir root for AppImage spec compliance
  execSync(`find "${appDir}/usr/share/applications" -name "*.desktop" -exec cp {} "${appDir}/" \\; 2>/dev/null || true`, { stdio: 'inherit' });
  execSync(`find "${appDir}/usr/share/icons" -name "*.png" -exec cp {} "${appDir}/" \\; 2>/dev/null || true`, { stdio: 'inherit' });

  // Link AppRun to compiled binary in usr/bin
  const binDir = path.join(appDir, 'usr', 'bin');
  if (fs.existsSync(binDir)) {
    const binFiles = fs.readdirSync(binDir);
    if (binFiles.length > 0) {
      execSync(`ln -sf "usr/bin/${binFiles[0]}" "${appDir}/AppRun"`, { stdio: 'inherit' });
    }
  }

  // Get or download appimagetool
  let appimageTool = 'appimagetool';
  try {
    execSync('which appimagetool', { stdio: 'ignore' });
  } catch {
    const localTool = path.join(process.cwd(), 'appimagetool-x86_64.AppImage');
    if (!fs.existsSync(localTool)) {
      execSync(`wget -q https://github.com/AppImage/AppImageKit/releases/download/continuous/appimagetool-x86_64.AppImage -O "${localTool}" && chmod +x "${localTool}"`, { stdio: 'inherit' });
    }
    appimageTool = localTool;
  }

  const outDir = path.join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle', 'appimage');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'MusicDL.AppImage');

  execSync(`APPIMAGE_EXTRACT_AND_RUN=1 ${appimageTool} "${appDir}" "${outPath}"`, { stdio: 'inherit' });
  console.log(`✅ Native AppImage successfully created: ${outPath}`);
} catch (err) {
  console.error('❌ Failed to package AppImage:', err.message);
}
