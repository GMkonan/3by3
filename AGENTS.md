# Agent Guidelines

## Commands
- **Build**: `bun run build` (runs tsc & vite build)
- **Dev**: `bun run dev`
- **Lint**: No dedicated script; `tsc` checks types.
- **Test**: Not currently configured.

## Deployment
- **Platform**: GitHub Pages via GitHub Actions.
- **Workflow**: `.github/workflows/deploy.yml` builds and deploys on push to `main`.
- **Config**: `vite.config.ts` sets `base: './'` for relative path support.

## Code Style & Conventions
- **Language**: TypeScript (ES2022 target, ESNext modules).
- **Package Manager**: Bun (`bun.lock` present). Use `bun install/add`.
- **Imports**: MUST use `import type` for type-only imports (`verbatimModuleSyntax`).
- **Syntax**: Do NOT use `enum` or `namespace` (`erasableSyntaxOnly`).
- **Strictness**: `strict` mode is enabled. No unused locals/params.
- **DOM**: Browser environment (`lib: ["DOM"]`).
- **Formatting**: Follow standard TypeScript conventions.

## Project Structure
- Source files in `src/`.
- Entry point: `index.html` -> `src/main.ts`.
