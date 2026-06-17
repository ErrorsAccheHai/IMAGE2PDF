# Image to PDF Converter

Convert JPEG or PNG images to PDF entirely on your device — no uploads, no server, no privacy concerns.

🚀 **Live Demo:** [https://image2pdflite.netlify.app/](https://image2pdflite.netlify.app/)

---

## About

Image to PDF Converter is a lightweight, privacy-first web app that lets you combine one or more images into a PDF file. All processing happens locally in your browser using [pdf-lib](https://pdf-lib.js.org/). Your files are never sent to any server.

---

## Features

- **Drag & drop** images onto the page or use the file picker
- **Reorder pages** by dragging thumbnails into the desired order
- **Delete pages** individually before generating
- **Page size options** — A4, US Letter, or same as image
- **Page orientation** — Portrait or Landscape
- **Page margin** — None, Small, or Big
- **Image compression** — optionally compress images with adjustable quality (0.1 – 1.0)
- **EXIF orientation** support — JPEG images with rotation metadata are rendered correctly
- **Mobile friendly** — touch drag-and-drop supported via `mobile-drag-drop`
- **No data uploaded** — everything runs in the browser

---

## Supported Formats

| Format | Support |
|--------|---------|
| JPEG / JPG | ✅ |
| PNG | ✅ |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or above recommended)
- npm

### Installation

```bash
git clone https://github.com/ErrorsAchheHai/image2pdf.git
cd image2pdf
npm install
```

### Running Locally

```bash
npm start
```

Opens the app at [http://localhost:3000](http://localhost:3000). The page hot-reloads on file changes.

### Building for Production

```bash
npm run build
```

Outputs an optimized production build to the `build/` folder.

---

## How to Use

1. Open the app and click **Select Images** or drag images into the drop zone.
2. Reorder the thumbnails by dragging them to the desired position.
3. Click a thumbnail to select it, then click the trash icon to remove a page.
4. Click **PDF Options** to configure page size, orientation, margin, and compression.
5. Click **Generate PDF** — the file downloads automatically as `file.pdf`.

---

## Tech Stack

| Library | Purpose |
|---------|---------|
| [React 18](https://react.dev/) | UI framework |
| [pdf-lib](https://pdf-lib.js.org/) | In-browser PDF creation |
| [exif-js](https://github.com/exif-js/exif-js) | Reading JPEG EXIF orientation |
| [mobile-drag-drop](https://github.com/timruffles/mobile-drag-drop) | Touch drag-and-drop polyfill |

---

## Project Structure

```
image2pdf/
├── public/          # Static assets and index.html
├── src/
│   ├── App.js       # Main application component
│   ├── App.css      # Styles
│   └── index.js     # React entry point
├── .env             # Environment config (source maps disabled)
├── package.json
└── README.md
```

---

## Deployment

The app is deployed on Netlify with automatic builds from the main branch.

Live URL: [https://image2pdflite.netlify.app/](https://image2pdflite.netlify.app/)

To deploy your own copy:

```bash
npm run build
# then drag the build/ folder into Netlify, or connect your repo for CI/CD
```

---

## License

This project is open source. Feel free to use, modify, and distribute it.
