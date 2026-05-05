import React, { useState, useEffect } from 'react'
import { FileUp, FileText, X, Settings, ArrowRight, CheckCircle2, Loader2, Files } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function App() {
  const [files, setFiles] = useState([])
  const [outputPath, setOutputPath] = useState('')
  const [isMerging, setIsMerging] = useState(true)
  const [isConverting, setIsConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const [resultSummary, setResultSummary] = useState(null)

  useEffect(() => {
    if (window.electron) {
      window.electron.onProgress((value) => {
        setProgress(value)
        setStatus(`Converting... ${Math.round(value)}%`)
      })
    }
  }, [])

  const handleSelectFiles = async () => {
    const selectedPaths = await window.electron.selectFiles()
    if (selectedPaths && selectedPaths.length > 0) {
      const newFiles = selectedPaths.map(path => ({
        path,
        name: path.split(/[\\/]/).pop(),
        type: path.split('.').pop().toUpperCase()
      }))
      setFiles(prev => [...prev, ...newFiles])
      setResultSummary(null)
    }
  }

  const handleSelectOutputPath = async () => {
    const path = await window.electron.selectOutputDirectory()
    if (path) setOutputPath(path)
  }

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index))
  }

  const handleConvert = async () => {
    if (files.length === 0) return

    setIsConverting(true)
    setProgress(0)
    setStatus('Starting conversion...')
    setResultSummary(null)

    const result = await window.electron.convertFiles(
      files.map(f => f.path),
      { mergeIntoOne: isMerging, outputPath }
    )

    setIsConverting(false)
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
      setStatus(`Error: ${result.error || 'Conversion failed'}`)
    }
  }

  return (
    <div className="app-container">
      <header className="header">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          PDF Converter Pro
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Seamlessly convert images and documents to professional PDFs
        </motion.p>
      </header>

      <main className="main-content">
        <section className="dropzone-container">
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="dropzone" onClick={handleSelectFiles}>
              <FileUp className="dropzone-icon" />
              <h3 style={{ margin: '0 0 8px 0' }}>Click to select files</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Images, PPTX, or existing PDFs
              </p>
            </div>

            <div className="file-list">
              <AnimatePresence>
                {files.map((file, index) => (
                  <motion.div 
                    key={`${file.path}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="file-item"
                  >
                    <div style={{ color: 'var(--primary)' }}>
                      {file.type === 'PDF' ? <FileText size={20} /> : <Files size={20} />}
                    </div>
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-type">{file.type} File</div>
                    </div>
                    <button className="remove-btn" onClick={() => removeFile(index)}>
                      <X size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {files.length === 0 && (
                <div style={{ textAlign: 'center', marginTop: '40px', color: 'var(--text-muted)' }}>
                  No files selected
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="sidebar">
          <div className="glass-panel">
            <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings size={20} /> Settings
            </h3>
            
            <div className="options-group">
              <div className="option-item" onClick={() => setIsMerging(!isMerging)}>
                <div className={`toggle ${isMerging ? 'active' : ''}`}></div>
                <div>
                  <div style={{ fontWeight: 500 }}>Merge into one PDF</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Combine all files into a single document
                  </div>
                </div>
              </div>

              <div className="output-path-selector">
                <div style={{ fontWeight: 500, marginBottom: '8px', fontSize: '0.9rem' }}>Output Location</div>
                <div className="path-display" onClick={handleSelectOutputPath}>
                  <span className="path-text">{outputPath || 'Default: "Converted PDF" folder'}</span>
                  <Settings size={14} style={{ opacity: 0.5 }} />
                </div>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {resultSummary && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel result-summary"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: resultSummary.failedCount > 0 ? '#fbbf24' : '#10b981', marginBottom: '12px' }}>
                  {resultSummary.failedCount > 0 ? <Loader2 size={18} /> : <CheckCircle2 size={18} />}
                  <span style={{ fontWeight: 600 }}>Results</span>
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  <div>✅ Successfully converted: {resultSummary.successCount}</div>
                  {resultSummary.failedCount > 0 && (
                    <div style={{ color: '#f87171', marginTop: '4px' }}>❌ Failed: {resultSummary.failedCount}</div>
                  )}
                  <div style={{ color: 'var(--text-muted)', marginTop: '8px', fontSize: '0.75rem' }}>
                    Saved to: {resultSummary.targetDir}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="glass-panel" style={{ marginTop: 'auto' }}>
            <button 
              className="convert-btn" 
              disabled={files.length === 0 || isConverting}
              onClick={handleConvert}
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
          </div>
        </aside>
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
