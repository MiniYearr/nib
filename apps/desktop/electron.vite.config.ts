import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

// Workspace packages ship TypeScript source, so they must be bundled rather
// than externalized — only real node_modules dependencies stay external.
const workspacePackages = [
  '@nib/core',
  '@nib/plugin-api',
  '@nib/plugin-notepad',
  '@nib/plugin-sample',
  '@nib/shell',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
  },
  renderer: {
    plugins: [react()],
  },
});
