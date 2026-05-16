import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github-dark.css'
import { 
  LayoutGrid, FileImage, FileStack, ChevronLeft, Layout, 
  Search, FileText, FileUp, Files, Settings, X, Loader2, ArrowRight,
  Database, Image as ImageIcon, Code, Type, Table, Scissors, Minimize2,
  CheckCircle2
} from 'lucide-react'

// Tools Catalog
const TOOLS = [
  { id: 'to_pdf', title: 'Images to PDF', description: 'Convert multiple images into a single PDF.', icon: <FileImage />, tags: ['jpg', 'png', 'webp', 'pdf', 'image', 'images2pdf'], view: 'to_pdf' },
  { id: 'merge_pdf', title: 'Merge PDFs', description: 'Combine multiple PDF files into one.', icon: <FileStack />, tags: ['pdf', 'merge', 'combine', 'join'], view: 'to_pdf' },
  { id: 'split_pdf', title: 'Split PDF', description: 'Extract pages from a PDF or split it.', icon: <Scissors />, tags: ['pdf', 'split', 'extract', 'cut', 'pages'], view: 'split_pdf' },
  { id: 'to_pptx', title: 'PDF to PowerPoint', description: 'Convert PDF slides into editable PPTX.', icon: <Layout />, tags: ['pdf', 'pptx', 'powerpoint', 'slides', 'ppt'], view: 'to_pptx' },
  { id: 'pptx_to_pdf', title: 'PowerPoint to PDF', description: 'High-quality PPTX to PDF conversion.', icon: <Layout />, tags: ['pptx', 'pdf', 'powerpoint', 'ppt', 'slides'], view: 'pptx_to_pdf' },
  { id: 'to_docx', title: 'PDF to Word', description: 'Advanced PDF to DOCX conversion.', icon: <FileText />, tags: ['pdf', 'docx', 'word', 'edit', 'doc'], view: 'to_docx' },
  { id: 'docx_to_pdf', title: 'Word to PDF', description: 'Professional DOCX to PDF conversion.', icon: <FileText />, tags: ['docx', 'word', 'pdf', 'doc'], view: 'docx_to_pdf' },
  { id: 'to_xlsx', title: 'PDF to Excel', description: 'Extract tables from PDF to XLSX.', icon: <Table />, tags: ['pdf', 'xlsx', 'excel', 'table', 'xls'], view: 'to_xlsx' },
  { id: 'xlsx_to_pdf', title: 'Excel to PDF', description: 'Convert spreadsheets to PDF.', icon: <Table />, tags: ['xlsx', 'excel', 'pdf', 'xls', 'spreadsheet'], view: 'xlsx_to_pdf' },
  { id: 'image_convert', title: 'Image Converter', description: 'Convert between JPG, PNG, WebP, AVIF.', icon: <ImageIcon />, tags: ['jpg', 'png', 'webp', 'avif', 'convert', 'img'], view: 'image_convert' },
  { id: 'md_to_pdf', title: 'Markdown to PDF', description: 'Professional MD editor with LaTeX.', icon: <Code />, tags: ['md', 'markdown', 'pdf', 'latex', 'editor'], view: 'md_to_pdf' },
  { id: 'html_to_pdf', title: 'HTML to PDF', description: 'Convert web pages or HTML to PDF.', icon: <Type />, tags: ['html', 'web', 'pdf', 'url'], view: 'html_to_pdf' },
  { id: 'json_csv', title: 'JSON to CSV', description: 'Convert JSON data to CSV tables.', icon: <Database />, tags: ['json', 'csv', 'data', 'convert'], view: 'json_to_csv' },
  { id: 'csv_json', title: 'CSV to JSON', description: 'Convert CSV files to JSON objects.', icon: <Database />, tags: ['csv', 'json', 'data', 'convert'], view: 'csv_to_json' },
  { id: 'compress_pdf', title: 'Compress PDF', description: 'Reduce PDF file size without quality loss.', icon: <Minimize2 />, tags: ['pdf', 'compress', 'size', 'shrink', 'optimize'], view: 'compress_pdf' },
]

// Set worker path for pdfjs
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker

const preprocessMarkdown = (text) => {
  if (!text) return ''
  
  // 1. Fix split list items
  let processed = text.replace(/^(\s*[\*\-\+])\s*\n+/gm, '$1 ');
  
  // 2. Fix tables broken by newlines
  const lines = processed.split('\n')
  const finalLines = []
  
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].trim()
    if (current === '') {
      if (finalLines.length > 0 && finalLines[finalLines.length-1].includes('|')) {
        // Check if table continues
        const nextRow = lines.slice(i+1).find(l => l.trim() !== '')
        if (nextRow && nextRow.includes('|')) continue // Skip empty line in table
      }
      finalLines.push('')
      continue
    }

    if (current.includes('|')) {
      const isSeparator = /^\|[ \t]*[:\- \t|]*\|$/.test(current)
      let next = lines[i+1]?.trim() || ''
      
      if (next.includes('|') && !isSeparator) {
        const nextIsSeparator = /^\|[ \t]*[:\- \t|]*\|$/.test(next)
        if (nextIsSeparator) {
          finalLines.push(current)
        } else {
          // Aggressively join fragmented cells
          lines[i+1] = current + ' ' + next
        }
      } else {
        finalLines.push(current)
      }
    } else {
      finalLines.push(lines[i])
    }
  }
  
  return finalLines.join('\n')
}

export default function App() {
  const [view, setView] = useState('home')
  const [searchTerm, setSearchTerm] = useState('')
  const [files, setFiles] = useState([])
  const [outputPath, setOutputPath] = useState('')
  const [isMerging, setIsMerging] = useState(true)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [resultSummary, setResultSummary] = useState(null)
  const [markdownText, setMarkdownText] = useState('# New Markdown File\n\nStart typing here...')
  const [mdFileName, setMdFileName] = useState('')
  const [htmlText, setHtmlText] = useState('<h1>Hello World</h1>\n<p>Start typing your HTML here...</p>')
  const [htmlFileName, setHtmlFileName] = useState('')
  const [splitRange, setSplitRange] = useState('')
  const [imageFormat, setImageFormat] = useState('png')
  const [imageQuality, setImageQuality] = useState(90)
  const [dataPreview, setDataPreview] = useState(null)
  const [thumbnails, setThumbnails] = useState([])

  useEffect(() => {
    if (window.electron) {
      window.electron.onProgress((value) => {
        setProgress(value)
        setStatus(`Converting... ${Math.round(value)}%`)
      })
    }
  }, [])

  const getFilters = (format) => {
    // These filters are for the SOURCE files (the input)
    switch(format) {
      case 'PDF': 
      case 'to_pdf': 
        return [{ name: 'Images & PDFs', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif', 'pdf'] }]
      case 'PPTX': 
      case 'DOCX': 
      case 'XLSX':
      case 'SPLIT_PDF':
      case 'COMPRESS_PDF':
      case 'PPTX_TO_PDF': // Wait, PPTX_TO_PDF input is PPTX
        if (format === 'PPTX_TO_PDF') return [{ name: 'PowerPoint Slides', extensions: ['pptx', 'ppt'] }]
        if (format === 'DOCX_TO_PDF') return [{ name: 'Word Documents', extensions: ['docx', 'doc'] }]
        if (format === 'XLSX_TO_PDF') return [{ name: 'Excel Spreadsheets', extensions: ['xlsx', 'xls'] }]
        return [{ name: 'PDF Files', extensions: ['pdf'] }]
      case 'JSON_TO_CSV': return [{ name: 'JSON Data', extensions: ['json'] }]
      case 'CSV_TO_JSON': return [{ name: 'CSV Data', extensions: ['csv'] }]
      case 'IMAGE': return [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'] }]
      case 'HTML_TO_PDF': return [{ name: 'HTML Files', extensions: ['html', 'htm'] }]
      default: return []
    }
  }

  const handleSelectFiles = async (format) => {
    const filters = getFilters(format)
    const selectedPaths = await window.electron.selectFiles({ filters })
    if (selectedPaths && selectedPaths.length > 0) {
      const newFiles = selectedPaths.map(path => ({
        path,
        name: path.split(/[\\/]/).pop(),
        type: path.split('.').pop().toLowerCase()
      }))
      setFiles(prev => [...prev, ...newFiles])
      setResultSummary(null)
      
      // Generate Previews for the first file
      const first = newFiles[0]
      if (first.type === 'pdf') {
        generatePdfThumbnails(first.path)
      } else if (['jpg', 'jpeg', 'png', 'webp', 'avif'].includes(first.type)) {
        const dataUrl = await window.electron.getFileDataUrl(first.path)
        setThumbnails([dataUrl])
      } else if (['json', 'csv', 'xlsx'].includes(first.type)) {
        generateDataPreview(first)
      }
    }
  }

  const generatePdfThumbnails = async (pdfPath) => {
    try {
      const loadingTask = pdfjsLib.getDocument(pdfPath)
      const pdf = await loadingTask.promise
      const thumbs = []
      const maxPages = Math.min(pdf.numPages, 6)
      
      for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 0.2 })
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        canvas.height = viewport.height
        canvas.width = viewport.width
        
        await page.render({ canvasContext: context, viewport }).promise
        thumbs.push(canvas.toDataURL())
      }
      setThumbnails(thumbs)
    } catch (error) {
      console.error('Thumbnail error:', error)
    }
  }

  const generateDataPreview = async (file) => {
    try {
      const content = await fs.promises.readFile(file.path, 'utf8')
      if (file.type === 'json') {
        const data = JSON.parse(content)
        const rows = Array.isArray(data) ? data.slice(0, 5) : [data]
        const columns = Object.keys(rows[0] || {})
        setDataPreview({ columns, rows: rows.map(r => Object.values(r)) })
      } else if (file.type === 'csv') {
        const lines = content.split('\n').slice(0, 6)
        const columns = lines[0].split(',')
        const rows = lines.slice(1).map(l => l.split(','))
        setDataPreview({ columns, rows })
      }
    } catch (error) {
      console.error('Data preview error:', error)
    }
  }

  const handleSelectOutputPath = async () => {
    const path = await window.electron.selectOutputDirectory()
    if (path) setOutputPath(path)
  }

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleLoadMarkdown = async (options = {}) => {
    const result = await window.electron.readMarkdownFile(options)
    if (result) {
      setMarkdownText(result.content)
      setMdFileName(result.fileName)
    }
  }

  const convertPdfToImages = async (pdfPath) => {
    const loadingTask = pdfjsLib.getDocument(pdfPath)
    const pdf = await loadingTask.promise
    const images = []
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 2.0 }) // Higher scale for better quality
      
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      await page.render({ canvasContext: context, viewport }).promise
      images.push(canvas.toDataURL('image/png'))
      setProgress((i / pdf.numPages) * 100)
    }
    
    return images
  }

  const handleConvert = async (format, options = {}) => {
    if (files.length === 0 && format !== 'MD_TO_PDF' && format !== 'HTML_TO_PDF') return
    
    setIsConverting(true)
    setProgress(0)
    setStatus('Initializing...')
    setResultSummary(null)

    const targetFormat = format || 'PDF'

    try {
      if (targetFormat === 'DOCX') {
        let totalProcessed = 0
        const pdfFiles = files.filter(f => f.type === 'PDF')
        
        if (pdfFiles.length === 0) {
          throw new Error('No PDF files selected for DOCX conversion')
        }

        for (const file of pdfFiles) {
          setStatus(`Converting PDF to Word: ${file.name}...`)
          const targetDir = outputPath || file.path.split(/[\\/]/).slice(0, -1).join('/') + '/Converted DOCX'
          
          const result = await window.electron.convertToDocx(file.path, {
            outputPath: targetDir
          })
          
          if (result.success) {
            totalProcessed++
          } else {
            throw new Error(result.error || 'Conversion failed')
          }
        }
        
        setStatus('Conversion complete!')
        setResultSummary({
          successCount: totalProcessed,
          failedCount: pdfFiles.length - totalProcessed,
          errors: [],
          targetDir: outputPath || 'Converted DOCX folder'
        })
        if (totalProcessed === pdfFiles.length) setFiles([])
      } else if (targetFormat === 'PPTX') {
        let totalProcessed = 0
        const pdfFiles = files.filter(f => f.type === 'PDF')
        
        if (pdfFiles.length === 0) {
          throw new Error('No PDF files selected for PPTX conversion')
        }

        for (const file of pdfFiles) {
          setStatus(`Rendering PDF: ${file.name}...`)
          const images = await convertPdfToImages(file.path)
          
          setStatus(`Generating PPTX for ${file.name}...`)
          const fileName = file.name.replace(/\.[^/.]+$/, "")
          const targetDir = outputPath || file.path.split(/[\\/]/).slice(0, -1).join('/') + '/Converted PPTX'
          
          const result = await window.electron.convertToPptx(images, {
            outputPath: targetDir,
            fileName: fileName
          })
          
          if (result.success) {
            totalProcessed++
          }
        }
        
        setStatus('Conversion complete!')
        setResultSummary({
          successCount: totalProcessed,
          failedCount: pdfFiles.length - totalProcessed,
          errors: [],
          targetDir: outputPath || 'Converted PPTX folder'
        })
        if (totalProcessed === pdfFiles.length) setFiles([])
      } else if (targetFormat === 'PDF') {
        // Original PDF conversion logic
        const result = await window.electron.convertFiles(
          files.map(f => f.path),
          { mergeIntoOne: isMerging, outputPath }
        )

        if (result.success || (result.count > 0)) {
          setStatus(result.failedCount > 0 ? 'Completed with some errors' : 'Conversion complete!')
          setResultSummary({
            successCount: result.count,
            failedCount: result.failedCount,
            errors: result.errors,
            targetDir: result.targetDir
          })
          if (result.failedCount === 0) setFiles([])
        } else {
          throw new Error(result.error || 'Conversion failed')
        }
      } else if (targetFormat === 'MD_TO_PDF') {
        setStatus('Preparing Markdown for conversion...')
        const previewElement = document.getElementById('md-preview')
        const htmlContent = previewElement ? previewElement.innerHTML : ''
        
        if (!htmlContent) throw new Error('No content to convert')

        const result = await window.electron.convertMarkdownToPdf(htmlContent, {
          outputPath: outputPath,
          fileName: mdFileName.replace(/\.[^/.]+$/, "") || 'markdown_export'
        })

        if (result.success) {
          setStatus('Conversion complete!')
          setResultSummary({
            successCount: 1,
            failedCount: 0,
            errors: [],
            targetDir: outputPath || 'Default folder'
          })
        } else {
          throw new Error(result.error || 'Markdown conversion failed')
        }
      } else if (targetFormat === 'XLSX_TO_PDF') {
        setStatus('Reading spreadsheet...')
        const result = await window.electron.convertExcelToPdf(files[0].path, {
          outputPath: outputPath
        })
        if (result.success) setStatus('Conversion complete!')
        else throw new Error(result.error)
      } else if (targetFormat === 'JSON_TO_CSV') {
        setStatus('Parsing JSON...')
        const content = await fs.promises.readFile(files[0].path, 'utf8')
        const result = await window.electron.convertJsonToCsv(content, {
          outputPath: outputPath
        })
        if (result.success) setStatus('CSV Saved!')
        else throw new Error(result.error)
      } else if (targetFormat === 'CSV_TO_JSON') {
        setStatus('Parsing CSV...')
        const content = await fs.promises.readFile(files[0].path, 'utf8')
        const result = await window.electron.convertCsvToJson(content, {
          outputPath: outputPath
        })
        if (result.success) setStatus('JSON Saved!')
        else throw new Error(result.error)
      } else if (targetFormat === 'SPLIT_PDF') {
        if (!splitRange) throw new Error('Please enter a page range (e.g., 1-3, 5)')
        setStatus('Splitting PDF...')
        const result = await window.electron.splitPdf(files[0].path, {
          range: splitRange,
          outputPath: outputPath
        })
        if (result.success) setStatus('PDF Split successfully!')
        else throw new Error(result.error)
      } else if (targetFormat === 'IMAGE') {
        setStatus('Converting images...')
        const result = await window.electron.convertImages(files.map(f => f.path), {
          format: imageFormat,
          quality: imageQuality,
          outputPath: outputPath
        })
        if (result.success) setStatus('Images converted!')
        else throw new Error(result.error)
      } else if (targetFormat === 'HTML_TO_PDF') {
        setStatus('Preparing HTML for conversion...')
        const editorContent = options.text || htmlText
        const result = await window.electron.convertMarkdownToPdf(editorContent, {
          outputPath: outputPath,
          fileName: (options.name || htmlFileName).replace(/\.[^/.]+$/, "") || 'html_export'
        })
        if (result.success) setStatus('HTML Exported!')
        else throw new Error(result.error)
      }
    } catch (err) {
      console.error(err)
      setStatus(`Error: ${err.message}`)
    } finally {
      setIsConverting(false)
    }
  }

  const handleNavigate = (newView) => {
    setView(newView)
    setFiles([])
    setResultSummary(null)
    setStatus('')
    setProgress(0)
  }

  const filteredTools = TOOLS.filter(tool => {
    if (!searchTerm) return true
    
    const terms = searchTerm.toLowerCase().split(/\s+|to|2/).filter(t => t.length > 0)
    const searchableText = `${tool.title} ${tool.description} ${tool.tags.join(' ')}`.toLowerCase()
    
    // Pro-level matching: check if ALL terms in search appear in the tool's text
    return terms.every(term => searchableText.includes(term))
  })

  const renderHome = () => (
    <div className="home-container">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: '40px' }}
      >
        <h1 style={{ fontSize: '3.5rem', marginBottom: '16px' }}>File Converter Pro</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Professional conversion tools at your fingertips</p>
        
        <div className="search-wrapper">
          <Search className="search-icon" size={20} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search for a converter (e.g., PDF to Word, Image Converter)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </motion.div>

      <div className="tools-grid">
        <AnimatePresence mode="popLayout">
          {filteredTools.map((tool) => (
            <ToolCard 
              key={tool.id}
              icon={tool.icon}
              title={tool.title}
              description={tool.description}
              tags={tool.tags}
              onClick={() => handleNavigate(tool.view)}
            />
          ))}
        </AnimatePresence>
        {filteredTools.length === 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="empty-search-container"
          >
            <Search size={48} style={{ opacity: 0.2, marginBottom: '20px' }} />
            <h3>No converters found for "{searchTerm}"</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>
              Try searching for "PDF", "Excel", "Word", or specific formats like "PNG".
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )

  const renderToolHeader = (title) => (
    <div className="nav-header">
      <button className="back-btn" onClick={() => handleNavigate('home')}>
        <ChevronLeft size={20} /> Back to Home
      </button>
      <h3 style={{ margin: 0, opacity: 0.5 }}>{title}</h3>
    </div>
  )

  const renderPdfTools = () => (
    <div className="tool-view-container">
      {renderToolHeader('Images & PDFs to PDF')}
      <div className="tool-header">
        <h2>PDF Converter & Merger</h2>
      </div>
      
      <div className="tool-content-layout">
        <div className="tool-main-pane">
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="dropzone" onClick={() => handleSelectFiles('to_pdf')}>
              <FileUp className="dropzone-icon" />
              <h3 style={{ margin: '0 0 8px 0' }}>Click to select files</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Images or existing PDFs
              </p>
            </div>
            <div className="file-list">
              <AnimatePresence>
                {files.map((file, index) => (
                  <motion.div key={index} className="file-item">
                    <FileText size={20} color="var(--primary)" />
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-type">{file.type}</div>
                    </div>
                    <button className="remove-btn" onClick={() => removeFile(index)}><X size={16}/></button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="tool-sidebar-pane">
          <div className="glass-panel">
            <h3 style={{ margin: '0 0 20px 0' }}><Settings size={18} /> Options</h3>
            <div className="option-item" onClick={() => setIsMerging(!isMerging)}>
              <div className={`toggle ${isMerging ? 'active' : ''}`}></div>
              <div>
                <div style={{ fontWeight: 500 }}>Merge into one PDF</div>
              </div>
            </div>
            <div className="output-path-selector" style={{ marginTop: '20px' }}>
              <div style={{ fontWeight: 500, marginBottom: '8px' }}>Output Location</div>
              <div className="path-display" onClick={handleSelectOutputPath}>
                <span className="path-text">{outputPath || 'Default Folder'}</span>
              </div>
            </div>
          </div>
          
          <ConversionControls 
            files={files} 
            isConverting={isConverting} 
            progress={progress} 
            status={status} 
            resultSummary={resultSummary}
            onConvert={() => handleConvert('PDF')}
          />
        </div>
      </div>
    </div>
  )

  const renderFormatTool = (format) => {
    let title = ""
    let description = ""

    switch(format) {
      case 'PPTX': 
        title = 'PDF to PowerPoint'
        description = 'Convert PDF slides into editable PPTX.'
        break
      case 'DOCX':
        title = 'PDF to Word'
        description = 'Convert PDF documents into editable Word files.'
        break
      case 'XLSX_TO_PDF':
        title = 'Excel to PDF'
        description = 'Convert spreadsheets to professional PDF documents.'
        break
      case 'JSON_TO_CSV':
        title = 'JSON to CSV'
        description = 'Transform JSON data structures into flat CSV tables.'
        break
      case 'CSV_TO_JSON':
        title = 'CSV to JSON'
        description = 'Convert CSV table data into JSON objects.'
        break
      case 'SPLIT_PDF':
        title = 'Split PDF'
        description = 'Extract specific pages or split document.'
        break
      case 'IMAGE':
        title = 'Image Converter'
        description = 'Convert images to JPG, PNG, WebP or AVIF.'
        break
      default:
        title = `Converter: ${format}`
        description = `Professional ${format} processing tool.`
    }

    return (
      <div className="tool-view-container">
        {renderToolHeader(title)}
        
        <div className="tool-content-layout">
          <div className="tool-main-pane">
            <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
              <div className="dropzone" onClick={() => handleSelectFiles(format)}>
                <FileUp className="dropzone-icon" />
                <h3>{files.length > 0 ? `${files.length} Files Selected` : 'Select Source Files'}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Click to browse or drag & drop</p>
              </div>

              {/* Live Preview Area */}
              {files.length > 0 && (
                <div className="preview-area" style={{ marginTop: '24px', flex: 1 }}>
                  <h4 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <LayoutGrid size={18} /> Live Preview
                  </h4>
                  
                  {thumbnails.length > 0 ? (
                    <div className="thumbnail-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '16px' }}>
                      {thumbnails.map((thumb, idx) => (
                        <div key={idx} className="thumb-item" style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                          <img src={thumb} style={{ width: '100%', height: 'auto', display: 'block' }} />
                        </div>
                      ))}
                    </div>
                  ) : dataPreview ? (
                    <div className="data-preview-table" style={{ overflowX: 'auto', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '16px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr>{dataPreview.columns.map(c => <th key={c} style={{ textAlign: 'left', padding: '12px', borderBottom: '1px solid var(--border)', color: 'var(--primary)' }}>{c}</th>)}</tr>
                        </thead>
                        <tbody>
                          {dataPreview.rows.map((r, i) => <tr key={i}>{r.map((d, j) => <td key={j} style={{ padding: '12px', color: 'var(--text-muted)' }}>{d}</td>)}</tr>)}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                      No visual preview available for this format.
                    </div>
                  )}
                </div>
              )}
            <div className="file-list">
              {files.map((file, index) => (
                <div key={index} className="file-item">
                  <FileText size={20} />
                  <div className="file-info"><div className="file-name">{file.name}</div></div>
                  <button className="remove-btn" onClick={() => removeFile(index)}><X size={16}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>

          <div className="tool-sidebar-pane">
            <div className="glass-panel" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={18} /> Tool Options
              </h3>
              
              {/* Specific Tool Controls */}
              {format === 'SPLIT_PDF' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>Page Range</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 1-3, 5, 8-10" 
                    value={splitRange}
                    onChange={(e) => setSplitRange(e.target.value)}
                    style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }}
                  />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enter comma-separated page numbers or ranges.</p>
                </div>
              )}

              {format === 'IMAGE' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Target Format</label>
                    <select 
                      value={imageFormat}
                      onChange={(e) => setImageFormat(e.target.value)}
                      style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border)', padding: '12px', borderRadius: '10px', color: '#fff', outline: 'none' }}
                    >
                      <option value="png">PNG (Lossless)</option>
                      <option value="jpg">JPG (Best for photos)</option>
                      <option value="webp">WebP (Next-Gen)</option>
                      <option value="avif">AVIF (Ultra Compressed)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: '8px' }}>Quality: {imageQuality}%</label>
                    <input 
                      type="range" 
                      min="10" max="100" 
                      value={imageQuality}
                      onChange={(e) => setImageQuality(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: 'var(--primary)' }}
                    />
                  </div>
                </div>
              )}

              {(!['SPLIT_PDF', 'IMAGE'].includes(format)) && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No additional settings required for this format.</p>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '20px 0' }} />
              
              <div className="output-path-selector">
                <div style={{ fontWeight: 500, marginBottom: '8px' }}>Save Location</div>
                <div className="path-display" onClick={handleSelectOutputPath}>
                  <span className="path-text">{outputPath || 'Original Folder'}</span>
                </div>
              </div>
            </div>
          
          <ConversionControls 
            files={files} 
            isConverting={isConverting} 
            progress={progress} 
            status={status} 
            resultSummary={resultSummary}
            onConvert={() => handleConvert(format)}
          />
        </div>
      </div>
    </div>
    )
  }

  const renderMarkdownTool = () => (
    <div className="tool-view-container" style={{ height: '100%' }}>
      {renderToolHeader('Markdown to PDF')}
      <div className="markdown-feature-container">
        <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Advanced Markdown Editor</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Full width workspace with real-time LaTeX preview</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="load-md-btn" onClick={() => handleLoadMarkdown({ filters: [{ name: 'Markdown', extensions: ['md'] }] })}>
              <FileText size={16} /> Load MD File
            </button>
            <button className="convert-btn" style={{ width: 'auto', padding: '10px 24px' }} onClick={() => handleConvert('MD_TO_PDF')} disabled={isConverting}>
              {isConverting ? <Loader2 className="animate-spin" size={18} /> : 'Export PDF'}
            </button>
          </div>
        </div>

        <div className="md-editor-pane">
          <textarea 
            className="md-textarea"
            value={markdownText}
            onChange={(e) => setMarkdownText(e.target.value)}
            placeholder="Type or paste your Markdown here..."
          />
          <div id="md-preview" className="md-preview">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
            >
              {preprocessMarkdown(markdownText)}
            </ReactMarkdown>
          </div>
        </div>

        {status && (
          <div className="glass-panel" style={{ padding: '12px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isConverting && <Loader2 className="animate-spin" size={18} />}
              <span style={{ fontSize: '0.9rem' }}>{status}</span>
              {resultSummary && <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Success! Saved to {resultSummary.targetDir}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderHtmlTool = () => (
    <div className="tool-view-container" style={{ height: '100%' }}>
      {renderToolHeader('HTML to PDF')}
      <div className="markdown-feature-container">
        <div className="glass-panel" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Pro HTML Editor</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Write HTML directly or load a file</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="load-md-btn" onClick={async () => {
              const res = await window.electron.readMarkdownFile({ 
                filters: [{ name: 'HTML Files', extensions: ['html', 'htm'] }] 
              })
              if (res) { setHtmlText(res.content); setHtmlFileName(res.fileName) }
            }}>
              <FileUp size={16} /> Load HTML
            </button>
            <button className="export-pdf-btn" style={{ background: 'var(--primary)', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => handleConvert('HTML_TO_PDF')}>
              <FileUp size={16} /> Export to PDF
            </button>
          </div>
        </div>
        
        <div className="md-editor-layout">
          <div className="md-editor-pane">
            <textarea 
              className="md-textarea"
              value={htmlText}
              onChange={(e) => setHtmlText(e.target.value)}
              placeholder="Enter HTML code here..."
              style={{ height: '100%', minHeight: '600px' }}
            />
          </div>
          <div className="md-preview-pane" style={{ background: '#fff', padding: '0', borderRadius: '12px', overflow: 'hidden' }}>
            <div 
              id="html-preview"
              className="md-preview-content"
              style={{ padding: '30px', color: '#000', height: '100%', overflowY: 'auto' }}
              dangerouslySetInnerHTML={{ __html: htmlText }}
            />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="app-container">
      <div className="drag-region"></div>
      
      <main className="main-content" style={{ 
        display: 'block', 
        padding: view === 'home' ? '0' : (view === 'md_to_pdf' ? '0 10px' : '0 20px'),
        maxWidth: 'none',
        width: '100%'
      }}>
        {view === 'home' && renderHome()}
        {view === 'to_pdf' && renderPdfTools()}
        {view === 'to_pptx' && renderFormatTool('PPTX')}
        {view === 'pptx_to_pdf' && renderFormatTool('PPTX_TO_PDF')}
        {view === 'to_docx' && renderFormatTool('DOCX')}
        {view === 'docx_to_pdf' && renderFormatTool('DOCX_TO_PDF')}
        {view === 'to_xlsx' && renderFormatTool('XLSX')}
        {view === 'xlsx_to_pdf' && renderFormatTool('XLSX_TO_PDF')}
        {view === 'json_to_csv' && renderFormatTool('JSON_TO_CSV')}
        {view === 'csv_to_json' && renderFormatTool('CSV_TO_JSON')}
        {view === 'image_convert' && renderFormatTool('IMAGE')}
        {view === 'split_pdf' && renderFormatTool('SPLIT_PDF')}
        {view === 'html_to_pdf' && renderHtmlTool()}
        {view === 'compress_pdf' && renderFormatTool('COMPRESS_PDF')}
        {view === 'md_to_pdf' && renderMarkdownTool()}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}

function ToolCard({ icon, title, description, tags, onClick }) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="tool-card"
      onClick={onClick}
    >
      <div className="tool-icon-wrapper" style={{ 
        background: 'rgba(99, 102, 241, 0.1)', 
        padding: '12px', 
        borderRadius: '16px',
        color: 'var(--primary)',
        marginBottom: '4px'
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: '12px 0 8px' }}>{title}</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', flex: 1 }}>{description}</p>
      
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
        {tags && tags.slice(0, 3).map(tag => (
          <span key={tag} className="tool-tag">{tag}</span>
        ))}
      </div>
    </motion.div>
  )
}

function ConversionControls({ files, isConverting, progress, status, resultSummary, onConvert }) {
  return (
    <div className="glass-panel" style={{ marginTop: 'auto' }}>
      <button 
        className="convert-btn" 
        disabled={files.length === 0 || isConverting}
        onClick={onConvert}
      >
        {isConverting ? (
          <>
            <Loader2 className="animate-spin" size={20} />
            Converting...
          </>
        ) : (
          <>
            Convert Now
            <ArrowRight size={20} />
          </>
        )}
      </button>

      {isConverting && (
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      
      {status && <div className="status-text">{status}</div>}

      <AnimatePresence>
        {resultSummary && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="result-summary"
            style={{ marginTop: '16px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px' }}
          >
            <div style={{ fontWeight: 600, color: '#10b981', marginBottom: '4px' }}>Done!</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Successfully processed {resultSummary.successCount} files.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
