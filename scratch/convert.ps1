$ppt = New-Object -ComObject PowerPoint.Application
try {
    $pdfPath = "E:\Projects\FileConverterPro\test.pdf"
    $pptxPath = "E:\Projects\FileConverterPro\test.pptx"
    $pres = $ppt.Presentations.Open($pdfPath, -1, -1, 0)
    $pres.SaveAs($pptxPath, 1)
    $pres.Close()
} catch {
    Write-Host "Error: $($_.Exception.Message)"
} finally {
    $ppt.Quit()
}
