import { spawn } from 'child_process';
import os from 'os';

// Force linuxdeploy to extract and run without requiring FUSE (libfuse2) on modern Linux distros
process.env.APPIMAGE_EXTRACT_AND_RUN = '1';

const isWin = os.platform() === 'win32';
// Run tauri build via npx
const cmd = isWin ? 'npx.cmd' : 'npx';
const args = ['tauri', 'build'];

console.log('Starting desktop build with APPIMAGE_EXTRACT_AND_RUN=1...');

const child = spawn(cmd, args, {
  stdio: 'inherit',
  shell: isWin
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
