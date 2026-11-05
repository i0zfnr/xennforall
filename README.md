# Xenn for all

A React + TypeScript toolkit with no accounts, paid APIs, or file-upload server.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:5173. Build with `npm run build`; the `dist` directory can be served by any static host. The project is local and has not been published to the internet.

## Tools

- Merge PDFs, with file reordering
- Extract selected PDF pages into one document
- Rotate every page of a PDF
- Convert JPG / PNG / WebP images to a PDF
- Compress images to a quality-optimized JPG
- Convert images between PNG / JPG / WebP
- Resize images with preserved aspect ratio
- AI background removal using IMG.LY, downloaded only when needed

Files stay on the visitor's device. Google Fonts and the background-removal model are external downloads. AI requires an internet connection on first use and may be slow on low-powered devices. Encrypted PDFs are not supported. File selection is capped at 100 MB per file; actual limits depend on device memory. Image compression is lossy and does not guarantee a smaller result for every source.

## Open-source dependencies

Background removal uses @imgly/background-removal under AGPL-3.0. Its full license is in THIRD_PARTY_LICENSE_AGPL.md; upstream source: https://github.com/imgly/background-removal-js. Before public distribution, provide the complete corresponding application source to visitors under compatible terms and retain all dependency notices. React, Vite, Lucide, and pdf-lib have their own license notices in their packages.

`npm audit` reports a high-severity advisory in the background-removal package's Zod 3 dependency. npm offers only a downgrade of the background-removal library, not a compatible patched release. No untrusted schema is used by this app; do not force a major Zod override without checking library compatibility. Review upstream updates before production deployment.

## Verification

TypeScript checking and production build pass. Browser layout, category filtering, search, and tool dialogs are checked locally. Full AI inference needs a model download and is not verified in this environment.

## Application license and source
This application is released under AGPL-3.0. Complete source: https://github.com/i0zfnr/xennforall . See LICENSE.md.
