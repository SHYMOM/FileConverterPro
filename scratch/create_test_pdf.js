import { PDFDocument, rgb } from 'pdf-lib';
import fs from 'fs';

async function createPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  page.drawText('Hello, this is a test PDF for PPTX conversion.', {
    x: 50,
    y: 350,
    size: 20,
    color: rgb(0, 0.53, 0.71),
  });
  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync('test.pdf', pdfBytes);
  console.log('Created test.pdf');
}

createPdf();
