const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    autoHideMenuBar: true, 
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// PRINTER LOGIC: Listen for print requests from React
ipcMain.on('print-receipt', (event, htmlContent, printerName) => {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  printWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

  printWindow.webContents.on('did-finish-load', () => {
    const options = { silent: true, printBackground: true };
    if (printerName) {
      options.printerName = printerName;
    }
    
    printWindow.webContents.print(options, (success, failureReason) => {
      if (!success) console.log("Print failed: " + failureReason);
      printWindow.close();
    });
  });
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});