const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('desktopMeta', {
  isDesktopApp: true
});
