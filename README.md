# Papertrail Frontend

The web client for **Papertrail**, providing a browser-based PDF editing suite and **Papertrail Writer** — a full-featured, paginated rich-text document editor with multi-format export.

Built with [React](https://react.dev) 19, [Vite](https://vite.dev), [TypeScript](https://www.typescriptlang.org), and [Tailwind CSS](https://tailwindcss.com) v4.

---

## Features

### 1. Papertrail Writer (Create Document)
* **Paginated Rich-Text Canvas**: True WYSIWYG document editing with live page breaks, margins, and A4 / Letter layouts.
* **Rich Formatting**:
  * Headings, paragraphs, ordered/unordered lists.
  * Bold, italic, underline, strike-through.
  * Customizable text colors and text highlights with color picker.
* **Editable Tables**:
  * 3×3 default table insertion grid.
  * Full table manipulation: insert/delete rows and columns, navigate with Tab/Arrow keys.
* **Image Management**:
  * Local image upload (PNG, JPEG, WebP) with client-side validation and server persistence.
  * Alignment and resizing within paginated margins.
* **Horizontal Rules / Dividers**: Semantic dividers that flow across pages and exports.
* **Resilience & Autosave**:
  * Continuous autosave with revision tracking.
  * Local storage draft recovery gate if network or session drops.
* **Direct Multi-Format Export**:
  * **PDF**: Clean, vector-sharp paged export via backend rendering.
  * **Word (.docx)**: Genuine Microsoft Word document package.
  * **HTML (.html)**: Standalone HTML document with inlined assets.
  * **Plain Text (.txt)**: Structured, clean plain-text output.

### 2. PDF Editor & Studio
* **Viewer & Navigation**: High-fidelity PDF rendering powered by [PDF.js](https://mozilla.github.io/pdf.js/) and WebAssembly.
* **Annotations & Drawing**:
  * Smooth pressure-sensitive ink signatures and freehand drawing using `perfect-freehand`.
  * Highlight, rectangle, circle, and text annotations.
* **Redaction**: Client-side permanent text and vector redaction using [MuPDF](https://mupdf.com) WebAssembly.

### 3. PDF Utilities
* **Merge & Split**: Combine multiple PDFs or extract selected page ranges.
* **Compress**: Reduce PDF file size with variable quality presets.
* **Convert**: Full bidirectional document conversion suite:
  * **DOCX → PDF**: High-fidelity server-side conversion via Gotenberg (LibreOffice).
  * **PDF → DOCX**: Reconstructed editable Word document conversion powered by Python `pdf2docx`.
  * **PDF ↔ Images**: Client-side PDF page extraction to JPEG/PNG and image compilation to PDF.
* **OCR**: Client-side optical character recognition via [Tesseract.js](https://tesseract.projectnaptha.com/).

### 4. User Workspace & Documents
* Document management library with search, filtering, and sorting.
* Authentication with Google OAuth and email/password JWT sessions.

---

## Tech Stack

* **Framework**: React 19 + Vite 8
* **Language**: TypeScript 6
* **Styling**: Tailwind CSS v4
* **Editor Core**: [Tiptap](https://tiptap.dev) 3 (ProseMirror ecosystem)
* **PDF Engines**:
  * [MuPDF](https://mupdf.com) WebAssembly (`mupdf`)
  * [pdf-lib](https://pdf-lib.js.org/) + fontkit
  * [PDF.js](https://mozilla.github.io/pdf.js/) (`pdfjs-dist`)
* **State Management**: [Zustand](https://github.com/pmndrs/zustand) 5
* **Data Fetching**: [TanStack React Query](https://tanstack.com/query) 5
* **Icons & Animation**: [Lucide React](https://lucide.dev) & [Framer Motion](https://www.framer.com/motion/)

---

## Getting Started

### Prerequisites

* Node.js `20.x` or later (Node 24 recommended)
* npm `10.x` or later

### Installation

Clone the repository and install dependencies:

```bash
cd papertrail-website
npm install
```

### Environment Configuration

Create a `.env` file in the `papertrail-website` root directory:

```env
# Backend API Base URL
VITE_API_URL=http://localhost:3000

# Google OAuth Client ID (Optional)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Development Server

Start the Vite development server with HMR:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Building for Production

Compile TypeScript and build the optimized production bundle:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

---

## Project Structure

```text
papertrail-website/
├── src/
│   ├── api/             # API client functions (documents, writer, auth, billing)
│   ├── assets/          # Static logos, icons, and illustrations
│   ├── components/      # Reusable UI components (buttons, modals, dialogs)
│   ├── context/         # React contexts
│   ├── features/        # Feature-specific modules
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility helpers and library wrappers
│   ├── pages/           # Application views (Dashboard, Editor, Landing, Tools)
│   │   └── tools/       # PDF tool pages (Merge, Split, Compress, Convert)
│   ├── stores/          # Zustand state stores
│   └── writer/          # Papertrail Writer component suite & toolbar controls
├── public/              # Static public assets (favicons, wasm files)
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
└── vite.config.ts       # Vite and Tailwind build configuration
```

---

## License

Proprietary — All rights reserved.
