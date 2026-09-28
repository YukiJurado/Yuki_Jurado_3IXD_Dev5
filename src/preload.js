const { contextBridge, ipcRenderer } = require('electron');

// The web page gets only these named operations, not unrestricted file access.
contextBridge.exposeInMainWorld('focusDesk', {
  getState: () => ipcRenderer.invoke('state:get'),
  chooseVault: () => ipcRenderer.invoke('vault:choose'),
  createGroup: name => ipcRenderer.invoke('group:create', name),
  createTask: (title, details) => ipcRenderer.invoke('task:create', title, details),
  editTask: (id, title, colour, details) => ipcRenderer.invoke('task:edit', id, title, colour, details),
  completeTask: id => ipcRenderer.invoke('task:complete', id),
  reopenTask: id => ipcRenderer.invoke('task:reopen', id),
  deleteTask: id => ipcRenderer.invoke('task:delete', id),
  retryPending: () => ipcRenderer.invoke('events:retry'),
  setFocusMinutes: minutes => ipcRenderer.invoke('focus:settings', minutes),
  startFocus: selection => ipcRenderer.invoke('focus:start', selection),
  pauseFocus: () => ipcRenderer.invoke('focus:pause'),
  resumeFocus: () => ipcRenderer.invoke('focus:resume'),
  stopFocus: () => ipcRenderer.invoke('focus:stop'),
  finishFocus: () => ipcRenderer.invoke('focus:finish'),
  extendFocus: () => ipcRenderer.invoke('focus:extend'),
  setBreakMinutes: (short, long) => ipcRenderer.invoke('break:settings', short, long),
  startBreak: () => ipcRenderer.invoke('break:start'),
  resumeBreak: () => ipcRenderer.invoke('break:resume'),
  finishBreak: () => ipcRenderer.invoke('break:finish'),
  stopBreak: () => ipcRenderer.invoke('break:stop')
});
