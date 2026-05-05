import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

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

// IPC Handlers
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'All Files', extensions: ['jpg', 'png', 'jpeg', 'webp', 'pptx', 'ppt', 'pdf'] },
      { name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] },
      { name: 'PowerPoint', extensions: ['pptx', 'ppt'] }
    ]
  })
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
