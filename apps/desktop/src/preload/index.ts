import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('nib', {
  runtime: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
});
