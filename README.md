# PDF Converter Pro 🚀

**PDF Converter Pro** is a high-end, aesthetic desktop application designed to convert images, PowerPoint presentations, and documents into professional PDF files. Built with **Electron**, **React**, and **Vite**, it offers a premium user experience with glassmorphism design and high-performance conversion engines.

![PDF Converter Pro UI](C:\Users\USERAS\.gemini\antigravity\brain\e759e031-9882-4c8f-a90c-ebd82f8a6b8a\pdf_converter_ui_mockup_1777995616019.png)

## ✨ Features

- **Multi-Format Support**: 
  - 🖼️ **Images**: JPG, PNG, WebP, GIF.
  - 📊 **PowerPoint**: PPT, PPTX (requires PowerPoint installed on Windows).
  - 📄 **PDFs**: Existing PDFs can be merged.
- **Conversion Options**:
  - **Individual Conversion**: Convert each selected file into its own PDF.
  - **Merge Mode**: Combine multiple images and documents into a single, cohesive PDF file.
- **Smart Output Management**:
  - Automatically creates a `Converted PDF` folder next to your source files.
  - Custom output directory selection.
  - Automatic folder opening upon successful conversion.
- **Premium UI/UX**:
  - Sleek **Glassmorphism** design.
  - Smooth animations via **Framer Motion**.
  - Real-time conversion progress tracking.
  - Detailed success/error summaries.

## 🛠️ How It Works

### 1. Image Conversion
The app uses the **Sharp** image processing library to normalize images (resizing and format conversion) before embedding them into a PDF using **pdf-lib**. This ensures high quality and small file sizes.

### 2. PowerPoint Conversion (Windows)
On Windows, the application leverages the **PowerPoint COM interface** via PowerShell. This ensures that the generated PDFs look exactly like the original slides, maintaining fonts, layouts, and high-fidelity graphics.

### 3. PDF Merging
Using **pdf-lib**, the app can extract pages from multiple sources (both converted images and existing PDFs) and stitch them together into a new document without quality loss.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Microsoft PowerPoint](https://www.microsoft.com/en-us/microsoft-365/powerpoint) (Required for PPT/PPTX conversion on Windows)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/pdf-converter-pro.git
   cd pdf-converter-pro
   ```
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

### Running the App
- **Development Mode**:
  ```bash
  npm run dev
  ```
- **Building the EXE (Windows)**:
  ```bash
  npm run build
  npm run pack
  ```
  The portable executable will be generated in the `dist/` folder.

## 📖 For Users

1. **Select Files**: Click the big interactive area or drag and drop your files into the app.
2. **Settings**:
   - Toggle **"Merge into one PDF"** if you want everything in one file.
   - Click the **Output Location** box if you want to save the files somewhere specific.
3. **Convert**: Click the vibrant **"Convert Now"** button.
4. **Done!**: Once finished, the app will show a summary of successfully converted files and automatically open the folder containing your new PDFs.

## 📄 License
This project is licensed under the ISC License.

---
*Built with ❤️ for a better document experience.*
