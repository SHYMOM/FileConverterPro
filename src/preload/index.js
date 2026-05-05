import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  convertFiles: (files, options) => ipcRenderer.invoke('convert-files', files, options),
  onProgress: (callback) => ipcRenderer.on('conversion-progress', (_event, value) => callback(value))
})
