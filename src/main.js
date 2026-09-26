const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('node:path');
const { createStore } = require('./store');

// An isolated app-data folder for automated smoke tests; normal runs use Electron's default.
if (process.env.FOCUSDESK_TEST_USER_DATA) {
  const fs = require('node:fs');
  fs.mkdirSync(process.env.FOCUSDESK_TEST_USER_DATA, { recursive: true });
  app.setPath('userData', process.env.FOCUSDESK_TEST_USER_DATA);
}

app.whenReady().then(() => {
  const store = createStore(path.join(app.getPath('userData'), 'state.json'));
  ipcMain.handle('state:get', () => store.getState());
  ipcMain.handle('vault:choose', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Choose your Obsidian vault' });
    if (result.canceled) return store.getState();
    return store.selectVault(result.filePaths[0]);
  });
  ipcMain.handle('task:create', (_event, title, details) => store.createTask(title, details));
  ipcMain.handle('task:edit', (_event, id, title, colour, details) => store.editTask(id, title, colour, details));
  ipcMain.handle('task:complete', (_event, id) => store.completeTask(id));
  ipcMain.handle('task:reopen', (_event, id) => store.reopenTask(id));
  ipcMain.handle('task:delete', (_event, id) => store.deleteTask(id));
  ipcMain.handle('events:retry', () => store.retryPending());
  ipcMain.handle('focus:settings', (_event, minutes) => store.setFocusMinutes(minutes));
  ipcMain.handle('focus:start', (_event, selection) => store.startFocus(selection));
  ipcMain.handle('focus:pause', () => store.pauseFocus());
  ipcMain.handle('focus:resume', () => store.resumeFocus());
  ipcMain.handle('focus:stop', () => store.stopFocus());
  ipcMain.handle('focus:finish', () => store.finishFocus());
  ipcMain.handle('focus:extend', () => store.extendFocus());
  ipcMain.handle('break:settings', (_event, short, long) => store.setBreakMinutes(short, long));
  ipcMain.handle('break:start', () => store.startBreak());
  ipcMain.handle('break:resume', () => store.resumeBreak());
  ipcMain.handle('break:finish', () => store.finishBreak());
  ipcMain.handle('break:stop', () => store.stopBreak());
  setInterval(() => {
    try { store.tick(); } catch (error) { console.error('Focus checkpoint failed:', error); }
  }, 1000);

  function openWindow() {
    const window = new BrowserWindow({
      width: 860, height: 650, minWidth: 600, minHeight: 440,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    window.loadFile(path.join(__dirname, 'index.html'));
    window.on('close', event => {
      try { store.interruptFocus(); } catch (error) {
        event.preventDefault();
        dialog.showErrorBox('Could not save focus session', error.message);
      }
    });
  }
  openWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
