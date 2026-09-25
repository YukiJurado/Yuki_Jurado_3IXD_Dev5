const { contextBridge, ipcRenderer } = require('electron');

// Give the web page only these four actions, not unrestricted file-system access.
contextBridge.exposeInMainWorld('focusDesk', {
  getState: () => ipcRenderer.invoke('state:get'),
  chooseVault: () => ipcRenderer.invoke('vault:choose'),
  createTask: title => ipcRenderer.invoke('task:create', title),
  retryPending: () => ipcRenderer.invoke('events:retry')
});
