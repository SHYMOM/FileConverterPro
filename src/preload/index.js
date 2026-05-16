import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  selectFiles: (options) => ipcRenderer.invoke('select-files', options),
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  getFileDataUrl: (path) => ipcRenderer.invoke('get-file-data-url', path),
  convertFiles: (files, options) => ipcRenderer.invoke('convert-files', files, options),
  convertToPptx: (images, options) => ipcRenderer.invoke('convert-to-pptx', images, options),
  convertToDocx: (filePath, options) => ipcRenderer.invoke('convert-to-docx', filePath, options),
  convertExcelToPdf: (filePath, options) => ipcRenderer.invoke('convert-excel-to-pdf', filePath, options),
  convertMarkdownToPdf: (html, options) => ipcRenderer.invoke('convert-markdown-to-pdf', html, options),
  convertJsonToCsv: (json, options) => ipcRenderer.invoke('convert-json-to-csv', json, options),
  convertCsvToJson: (csv, options) => ipcRenderer.invoke('convert-csv-to-json', csv, options),
  splitPdf: (filePath, options) => ipcRenderer.invoke('split-pdf', filePath, options),
  convertImages: (files, options) => ipcRenderer.invoke('convert-images', files, options),
  readMarkdownFile: (options) => ipcRenderer.invoke('read-markdown-file', options),
  onProgress: (callback) => ipcRenderer.on('conversion-progress', (_event, value) => callback(value))
})
