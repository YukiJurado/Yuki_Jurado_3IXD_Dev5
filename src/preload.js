const { contextBridge, ipcRenderer } = require('electron');

// Give the web page only these four actions, not unrestricted file-system access.
contextBridge.exposeInMainWorld('focusDesk', {
  getState: () => ipcRenderer.invoke('state:get'),
  chooseVault: () => ipcRenderer.invoke('vault:choose'),
  createTask: title => ipcRenderer.invoke('task:create', title),
  editTask: (id, title, colour) => ipcRenderer.invoke('task:edit', id, title, colour),
  completeTask: id => ipcRenderer.invoke('task:complete', id),
  reopenTask: id => ipcRenderer.invoke('task:reopen', id),
  deleteTask: id => ipcRenderer.invoke('task:delete', id),
  retryPending: () => ipcRenderer.invoke('events:retry')
});
