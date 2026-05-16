import sys
import os
from pdf2docx import Converter
import logging

# Suppress warnings for a cleaner output
logging.getLogger('pdf2docx').setLevel(logging.ERROR)

def convert_pdf_to_docx(pdf_file, docx_file):
    """
    Converts PDF to DOCX with advanced layout preservation.
    """
    try:
        # Check if files exist
        if not os.path.exists(pdf_file):
            print(f"Error: PDF file not found: {pdf_file}")
            return False
            
        # Initialize converter
        cv = Converter(pdf_file)
        
        # Convert with all pages and layout optimization
        # multi_processing=True helps with speed
        cv.convert(docx_file, start=0, end=None)
        
        cv.close()
        return True
    except Exception as e:
        print(f"Conversion Error: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_docx_advanced.py <input_pdf> <output_docx>")
        sys.exit(1)
    
    input_pdf = sys.argv[1]
    output_docx = sys.argv[2]
    
    success = convert_pdf_to_docx(input_pdf, output_docx)
    
    if success:
        print("CONVERSION_SUCCESS")
        sys.exit(0)
    else:
        print("CONVERSION_FAILED")
        sys.exit(1)
