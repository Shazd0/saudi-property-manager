const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopMeta', {
  isDesktopApp: true
});

contextBridge.exposeInMainWorld('desktopCallWatch', {
  start: (config) => ipcRenderer.invoke('desktop:call-watch-start', config),
  stop: () => ipcRenderer.invoke('desktop:call-watch-stop'),
  onIncomingCall: (handler) => {
    const listener = (_event, session) => handler(session);
    ipcRenderer.on('amlak:incoming-call', listener);
    return () => ipcRenderer.removeListener('amlak:incoming-call', listener);
  },
});

contextBridge.exposeInMainWorld('desktopFS', {
  selectDirectory: () => ipcRenderer.invoke('desktop:select-directory'),
  writeBase64File: (payload) => ipcRenderer.invoke('desktop:write-base64-file', payload),
});
