const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (htmlContent, printerName) => ipcRenderer.send('print-receipt', htmlContent, printerName)
});