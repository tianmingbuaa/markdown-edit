# Third-Party Notices

墨页（Inkpage）使用了以下开源软件与字体。感谢这些项目的作者与贡献者。

## Runtime dependencies

| Project | License | Purpose |
| --- | --- | --- |
| [Electron](https://www.electronjs.org/) | MIT | Desktop application runtime |
| [Chromium](https://www.chromium.org/) / [Node.js](https://nodejs.org/) | BSD-style / MIT | Included with Electron; official license files are shipped in the packaged application |
| [React](https://react.dev/) / [React DOM](https://react.dev/) | MIT | Renderer UI |
| [Vditor](https://b3log.org/vditor/) | MIT | Markdown IR editor and preview engine |
| [Lucide](https://lucide.dev/) | ISC | Interface icons |
| [Noto Serif SC](https://fonts.google.com/noto/specimen/Noto+Serif+SC) | SIL OFL 1.1 | Bundled editor serif typeface |
| [Fontsource](https://fontsource.org/) | MIT | Font packaging and unicode-range delivery |

Vditor's runtime distribution also contains its own bundled assets and dependencies
(for example highlight.js, KaTeX and Mermaid) under their respective open-source
licenses. The full Vditor and font license texts are included in `licenses/`.

## Build and test dependencies

Vite, electron-vite, TypeScript, Vitest, Playwright Core, electron-builder and
their transitive dependencies are used for development, testing and packaging.
They are not required at runtime except for the Electron runtime itself.

## Included license texts

- [`licenses/NotoSerifSC-OFL.txt`](licenses/NotoSerifSC-OFL.txt)
- [`licenses/Vditor-MIT.txt`](licenses/Vditor-MIT.txt)
- [`licenses/React-MIT.txt`](licenses/React-MIT.txt)
- [`licenses/Lucide-ISC.txt`](licenses/Lucide-ISC.txt)
- Electron's license files are generated next to the packaged executable by electron-builder.

If you redistribute a packaged build, keep this file and the `licenses/` directory
with the application.
