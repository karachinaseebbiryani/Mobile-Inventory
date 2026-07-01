const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Added printerName parameter
  printReceipt: (htmlContent, printerName) => ipcRenderer.send('print-receipt', htmlContent, printerName)
});