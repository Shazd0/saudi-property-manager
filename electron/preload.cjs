const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopMeta', {
  isDesktopApp: true
});

contextBridge.exposeInMainWorld('desktopFS', {
  selectDirectory: () => ipcRenderer.invoke('desktop:select-directory'),
  writeBase64File: (payload) => ipcRenderer.invoke('desktop:write-base64-file', payload),
});
