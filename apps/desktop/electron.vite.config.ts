import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

// Workspace packages ship TypeScript source, so they must be bundled rather
// than externalized — only real node_modules dependencies stay external.
const workspacePackages = [
  '@nib/core',
  '@nib/plugin-api',
  '@nib/plugin-assistant',
  '@nib/plugin-diary',
  '@nib/plugin-media-anilist',
  '@nib/plugin-media-openlibrary',
  '@nib/plugin-media-tvmaze',
  '@nib/plugin-notepad',
  '@nib/plugin-sample',
  '@nib/plugin-todo',
  '@nib/shell',
];

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: workspacePackages })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          plugin: resolve(__dirname, 'src/preload/plugin.ts'),
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
});
