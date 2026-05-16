import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import sharp from 'sharp'
import PptxGenJS from 'pptxgenjs'
import * as XLSX from 'xlsx'
import jsonexport from 'jsonexport'
import { parse } from 'csv-parse/sync'
import path from 'path'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f172a',
      symbolColor: '#94a3b8',
      height: 35
    },
    webPreferences: {
      preload: join(app.getAppPath(), 'out/preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(app.getAppPath(), 'out/renderer/index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('get-file-data-url', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath)
    const ext = filePath.split('.').pop().toLowerCase()
    return `data:image/${ext};base64,${data.toString('base64')}`
  } catch (error) {
    return null
  }
})

ipcMain.handle('select-files', async (event, options = {}) => {
  const dialogOptions = {
    properties: ['openFile', 'multiSelections'],
  }
  
  if (options.filters && options.filters.length > 0) {
    dialogOptions.filters = options.filters
  } else {
    dialogOptions.filters = [
      { name: 'All Supported Files', extensions: ['pdf', 'jpg', 'png', 'jpeg', 'webp', 'docx', 'pptx', 'xlsx', 'md', 'html', 'json', 'csv'] },
      { name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp', 'avif'] },
      { name: 'Documents', extensions: ['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'md', 'html'] }
    ]
  }

  const result = await dialog.showOpenDialog(dialogOptions)
  if (result.canceled) return []
  return result.filePaths
})

ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  })
  if (result.canceled) return null
  return result.filePaths[0]
})

ipcMain.handle('convert-files', async (event, files, options) => {
  try {
    const { mergeIntoOne, outputPath } = options
    const pdfDocs = []
    const results = { success: 0, failed: 0, errors: [] }
    
    let total = files.length
    let current = 0

    const updateProgress = (progress) => {
      event.sender.send('conversion-progress', progress)
    }

    // Determine target directory (but don't create it yet)
    let targetDir = outputPath
    if (!targetDir && files.length > 0) {
      const firstFileDir = join(files[0], '..')
      targetDir = join(firstFileDir, 'Converted PDF')
    }

    for (const file of files) {
      const ext = file.split('.').pop().toLowerCase()
      let pdfBytes

      try {
        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
          // Process image with sharp - always convert to PNG for PDF embedding
          const image = sharp(file)
          const imgBuffer = await image.png().toBuffer()
          const metadata = await sharp(imgBuffer).metadata()
          
          const pdfDoc = await PDFDocument.create()
          const page = pdfDoc.addPage([metadata.width, metadata.height])
          const pdfImg = await pdfDoc.embedPng(imgBuffer)
          
          page.drawImage(pdfImg, { 
            x: 0, 
            y: 0, 
            width: metadata.width, 
            height: metadata.height 
          })
          pdfBytes = await pdfDoc.save()
        } else if (ext === 'pdf') {
          pdfBytes = fs.readFileSync(file)
        } else if (['pptx', 'ppt'].includes(ext)) {
          if (process.platform === 'win32') {
            const { execSync } = await import('child_process')
            const tempPdfPath = join(app.getPath('temp'), `conv_${Date.now()}.pdf`)
            
            // Correctly quote paths for PowerShell
            const psCommand = `
              $ppt_app = New-Object -ComObject PowerPoint.Application;
              $ppt_app.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse;
              $presentation = $ppt_app.Presentations.Open('${file}', $true, $true, $false);
              $presentation.SaveAs('${tempPdfPath}', 32);
              $presentation.Close();
              $ppt_app.Quit();
            `
            execSync(`powershell -Command "${psCommand.replace(/\n/g, ' ')}"`)
            
            if (fs.existsSync(tempPdfPath)) {
              pdfBytes = fs.readFileSync(tempPdfPath)
              fs.unlinkSync(tempPdfPath)
            } else {
              throw new Error('PowerPoint failed to generate PDF')
            }
          } else {
            throw new Error('PowerPoint conversion only supported on Windows')
          }
        }

        if (pdfBytes) {
          // Only create directory if we have a successful conversion
          if (targetDir && !fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true })
          }

          if (mergeIntoOne) {
            pdfDocs.push(await PDFDocument.load(pdfBytes))
          } else {
            const fileName = file.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "") + ".pdf"
            const finalPath = join(targetDir, fileName)
            fs.writeFileSync(finalPath, pdfBytes)
          }
          results.success++
        }
      } catch (err) {
        console.error(`Error converting ${file}:`, err)
        results.failed++
        results.errors.push(`${file.split(/[\\/]/).pop()}: ${err.message}`)
      }
      
      current++
      updateProgress((current / total) * 100)
    }

    let finalSavePath = ''
    if (results.success > 0) {
      if (mergeIntoOne && pdfDocs.length > 0) {
        const mergedPdf = await PDFDocument.create()
        for (const doc of pdfDocs) {
          const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices())
          copiedPages.forEach((page) => mergedPdf.addPage(page))
        }
        const mergedBytes = await mergedPdf.save()
        
        const fileName = files.length > 1 ? 'merged_output.pdf' : files[0].split(/[\\/]/).pop().replace(/\.[^/.]+$/, "") + ".pdf"
        finalSavePath = join(targetDir, fileName)
        fs.writeFileSync(finalSavePath, mergedBytes)
        shell.showItemInFolder(finalSavePath)
      } else if (targetDir && fs.existsSync(targetDir)) {
        shell.openPath(targetDir)
      }
    }

    return { 
      success: results.failed === 0 && results.success > 0, 
      count: results.success, 
      failedCount: results.failed,
      errors: results.errors,
      targetDir: results.success > 0 ? targetDir : null
    }
  } catch (error) {
    console.error('Conversion Error:', error)
    return { success: false, error: error.message }
  }
})
ipcMain.handle('convert-to-pptx', async (event, images, options) => {
  try {
    const { outputPath, fileName } = options
    const pptx = new PptxGenJS()
    
    for (const imgBase64 of images) {
      const slide = pptx.addSlide()
      // images is an array of base64 strings (with or without data:image/png;base64, prefix)
      slide.addImage({ 
        data: imgBase64, 
        x: 0, 
        y: 0, 
        w: '100%', 
        h: '100%' 
      })
    }

    const finalPath = join(outputPath, fileName + '.pptx')
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true })
    }

    const buffer = await pptx.write('nodebuffer')
    fs.writeFileSync(finalPath, buffer)
    
    shell.showItemInFolder(finalPath)
    return { success: true, path: finalPath }
  } catch (error) {
    console.error('PPTX Generation Error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('convert-to-docx', async (event, filePath, options) => {
  try {
    const { outputPath } = options
    const fileName = filePath.split(/[\\/]/).pop().replace(/\.[^/.]+$/, "") + ".docx"
    const finalPath = join(outputPath, fileName)

    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true })
    }

    const { execSync } = await import('child_process')
    const pythonScript = join(app.getAppPath(), 'src/main/pdf_to_docx_advanced.py')
    
    // Check if python is available
    try {
      execSync('python --version')
    } catch (e) {
      throw new Error('Python is required for advanced Word conversion. Please install Python.')
    }

    const command = `python "${pythonScript}" "${filePath}" "${finalPath}"`
    const output = execSync(command).toString()

    if (output.includes('CONVERSION_SUCCESS') && fs.existsSync(finalPath)) {
      shell.showItemInFolder(finalPath)
      return { success: true, path: finalPath }
    } else {
      throw new Error(output || 'Advanced conversion failed')
    }
  } catch (error) {
    console.error('DOCX Generation Error:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('read-markdown-file', async (event, options = {}) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: options.filters || [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
  })
  if (result.canceled) return null
  return {
    content: fs.readFileSync(result.filePaths[0], 'utf-8'),
    fileName: result.filePaths[0].split(/[\\/]/).pop()
  }
})

ipcMain.handle('convert-markdown-to-pdf', async (event, htmlContent, options) => {
  try {
    const { outputPath, fileName } = options
    let finalPath = ''
    
    if (!outputPath) {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Export PDF',
        defaultPath: (fileName || 'markdown_export') + '.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return { success: false, error: 'Cancelled' }
      finalPath = filePath
    } else {
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true })
      }
      const finalFileName = (fileName || 'markdown_export') + '.pdf'
      finalPath = join(outputPath, finalFileName)
    }

    const workerWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true
      }
    })

    // Add some default styles for the PDF
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/styles/github-dark.min.css">
        <style>
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
          }
          pre {
            background: #f4f4f4;
            padding: 1rem;
            border-radius: 8px;
            overflow-x: auto;
          }
          code {
            font-family: 'Fira Code', 'Courier New', Courier, monospace;
            background: #f4f4f4;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          th {
            background-color: #f8f9fa;
          }
          blockquote {
            border-left: 4px solid #6366f1;
            margin: 0;
            padding-left: 1rem;
            color: #666;
            font-style: italic;
          }
          img {
            max-width: 100%;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `

    await workerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`)
    
    // Give a small delay for any rendering/mathjax to finish
    await new Promise(resolve => setTimeout(resolve, 1000))

    const pdfData = await workerWindow.webContents.printToPDF({
      printBackground: true,
      margins: {
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5
      },
      pageSize: 'A4'
    })

    fs.writeFileSync(finalPath, pdfData)
    workerWindow.destroy()

    shell.showItemInFolder(finalPath)
    return { success: true, path: finalPath }
  } catch (error) {
    console.error('Markdown to PDF Error:', error)
    return { success: false, error: error.message }
  }
})
// Excel/CSV/JSON Handlers
ipcMain.handle('convert-excel-to-pdf', async (event, filePath, options) => {
  try {
    const workbook = XLSX.readFile(filePath)
    const firstSheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[firstSheetName]
    const htmlContent = XLSX.utils.sheet_to_html(worksheet)
    
    // Reuse the markdown to pdf logic for HTML
    return await event.sender.invoke('convert-markdown-to-pdf', htmlContent, options)
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('convert-json-to-csv', async (event, jsonString, options) => {
  try {
    const data = JSON.parse(jsonString)
    const csv = await jsonexport(data)
    
    let finalPath = options.outputPath
    if (!finalPath) {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save CSV',
        defaultPath: 'converted_data.csv',
        filters: [{ name: 'CSV', extensions: ['csv'] }]
      })
      if (canceled || !filePath) return { success: false }
      finalPath = filePath
    }
    
    fs.writeFileSync(finalPath, csv)
    return { success: true, path: finalPath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('convert-csv-to-json', async (event, csvString, options) => {
  try {
    const records = parse(csvString, { columns: true, skip_empty_lines: true })
    const json = JSON.stringify(records, null, 2)
    
    let finalPath = options.outputPath
    if (!finalPath) {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save JSON',
        defaultPath: 'converted_data.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (canceled || !filePath) return { success: false }
      finalPath = filePath
    }
    
    fs.writeFileSync(finalPath, json)
    return { success: true, path: finalPath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('split-pdf', async (event, filePath, options) => {
  try {
    const { range, outputPath } = options
    const existingPdfBytes = fs.readFileSync(filePath)
    const pdfDoc = await PDFDocument.load(existingPdfBytes)
    const newPdf = await PDFDocument.create()
    
    // Parse range (e.g., 1-3, 5)
    const pagesToExtract = []
    const parts = range.split(',')
    for (const part of parts) {
      const p = part.trim()
      if (p.includes('-')) {
        const [start, end] = p.split('-').map(n => parseInt(n.trim()) - 1)
        for (let i = start; i <= end; i++) {
          if (i >= 0 && i < pdfDoc.getPageCount()) pagesToExtract.push(i)
        }
      } else {
        const pageIdx = parseInt(p) - 1
        if (pageIdx >= 0 && pageIdx < pdfDoc.getPageCount()) pagesToExtract.push(pageIdx)
      }
    }

    if (pagesToExtract.length === 0) throw new Error('Invalid page range')

    const copiedPages = await newPdf.copyPages(pdfDoc, pagesToExtract)
    copiedPages.forEach(page => newPdf.addPage(page))
    
    const pdfBytes = await newPdf.save()
    const originalName = filePath.split(/[\\/]/).pop().replace('.pdf', '')
    const targetDir = outputPath || path.dirname(filePath)
    const finalPath = join(targetDir, `${originalName}_split.pdf`)
    
    fs.writeFileSync(finalPath, pdfBytes)
    return { success: true, path: finalPath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('convert-images', async (event, files, options) => {
  try {
    const { format, quality, outputPath } = options
    const results = []
    
    for (const file of files) {
      const originalName = file.split(/[\\/]/).pop().split('.').shift()
      const targetDir = outputPath || join(path.dirname(file), 'Converted Images')
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
      
      const finalPath = join(targetDir, `${originalName}.${format}`)
      
      await sharp(file)
        .toFormat(format, { quality: quality || 90 })
        .toFile(finalPath)
        
      results.push(finalPath)
    }
    
    return { success: true, files: results }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
