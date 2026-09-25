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
  ipcMain.handle('task:create', (_event, title) => store.createTask(title));
  ipcMain.handle('events:retry', () => store.retryPending());

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
  }
  openWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
