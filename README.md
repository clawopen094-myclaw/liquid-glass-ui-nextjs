# Liquid Glass — Next.js

**Apple Vision Pro-inspired glass effects for Next.js. One import. Zero dependencies. WebGL-powered.**

![Liquid Glass](https://raw.githubusercontent.com/clawopen094-myclaw/liquid-glass-ui-nextjs/main/assets/banner.png)

```bash
npm install liquid-glass
```

```tsx
// next.config.ts
const nextConfig = { transpilePackages: ["liquid-glass"] }

// app/layout.tsx
import "liquid-glass/dist/styles.css"

// app/page.tsx
"use client"
import { GlassContainer, GlassButton } from "liquid-glass/react"

export default function Page() {
  return (
    <GlassContainer type="pill" tintOpacity={0.3} borderRadius={24}>
      <GlassButton text="Save" size={24} type="pill" onClick={() => alert("Saved!")} />
      <GlassButton text="✓" size={24} type="circle" />
    </GlassContainer>
  )
}
```

---

## Why This Exists

This is a ground-up reimplementation of [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js) — a library with 427 GitHub stars that brings Apple's Liquid Glass design language to the web via WebGL shaders. The original used JS builder classes (`new Container()` / `new Button()`). This version is rebuilt as:

- **Autonomous Web Components** — `<glass-container>` and `<glass-button>` work in every browser (Chrome, Firefox, Safari, Edge)
- **SSR-safe Next.js wrappers** — `"use client"` components with `suppressHydrationWarning`, zero build errors
- **All known bugs fixed** — `tintOpacity` parsing, circular imports, snapshot race conditions, memory leaks, Safari compatibility
- **Nested glass auto-detection** — place a `<GlassButton>` inside a `<GlassContainer>` and it automatically renders layered glass with child-samples-parent refraction
- **1,243 lines total** — 1,039 lines core + 147 lines React + CSS. No build step. No dependencies.

---

## Features

- **Three shape types** — Rounded rectangles, perfect circles, pill/capsule shapes
- **Real-time WebGL refraction** — Multi-layer shaders with shape-aware normals, edge/rim/base intensity, Gaussian blur (13×13 kernel), ripple textures
- **Nested glass system** — Child buttons sample parent container output for true layered effects
- **Per-instance tintOpacity** — Each glass element can have its own gradient overlay strength (0–1)
- **Center warp toggle** — Optional content distortion for dramatic effects
- **Live parameter control** — Global `window.__glassControls` object for real-time tuning
- **Responsive sizing** — Automatic text-based sizing, viewport adaptation
- **Full lifecycle cleanup** — `disconnectedCallback` cancels rAF loops, removes listeners, deletes WebGL textures/buffers
- **WebGL context recovery** — Listens for `webglcontextlost` / `webglcontextrestored`
- **Snapshot retry** — `capturePageSnapshot` retries once on CORS/network failure

---

## Installation & Setup

### 1. Install

```bash
npm install liquid-glass
```

### 2. Configure Next.js

```ts
// next.config.ts
import type { NextConfig } from "next"
const nextConfig: NextConfig = { transpilePackages: ["liquid-glass"] }
export default nextConfig
```

`transpilePackages` tells Turbopack/Webpack to JSX-transform the library's React components.

### 3. Import CSS

```tsx
// app/layout.tsx
import "liquid-glass/dist/styles.css"
```

### 4. Use Components

Any client component:

```tsx
"use client"
import { GlassContainer, GlassButton } from "liquid-glass/react"

<GlassContainer type="pill" tintOpacity={0.3} borderRadius={24}>
  <GlassButton text="Save" size={24} type="pill" onClick={() => alert("Saved!")} />
  <GlassButton text="✓" size={24} type="circle" />
</GlassContainer>
```

That's it. html2canvas loads automatically from CDN on first render. No configuration needed.

---

## API Reference

### `<GlassContainer>`

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'rounded'` \| `'circle'` \| `'pill'` | `'rounded'` | Shape geometry |
| `borderRadius` | `number` | `48` | Corner radius in pixels |
| `tintOpacity` | `number` (0–1) | `0.2` | Gradient overlay strength |
| `warp` | `boolean` | `false` | Enable center distortion effect |
| `className` | `string` | — | Additional CSS classes |
| `style` | `CSSProperties` | — | Inline styles |
| `children` | `ReactNode` | — | Content — typically `<GlassButton>` elements |

### `<GlassButton>`

Extends all `<GlassContainer>` props, plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | `string` | `'Button'` | Button label |
| `size` | `number` | `48` | Font size in pixels |
| `onClick` | `() => void` | — | Click event handler |

### Vanilla HTML

```html
<link rel="stylesheet" href="dist/styles.css" />
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script type="module" src="src/core/index.js"></script>

<glass-container type="pill" border-radius="24" tint-opacity="0.3">
  <glass-button text="Hello" size="24" type="pill"></glass-button>
</glass-container>
```

### JS API

```js
import { GlassContainer, GlassButton } from "liquid-glass"

const container = GlassContainer.create({
  type: "pill", borderRadius: 24, tintOpacity: 0.3
})

const button = GlassButton.create({
  text: "Click Me", size: 24, type: "rounded",
  onClick: (text) => alert(text)
})

container.appendChild(button)
document.body.appendChild(container)
```

---

## Architecture

```
liquid-glass/
├── package.json          # name: "liquid-glass", type: "module"
├── index.ts              # Vanilla JS re-exports
├── react.js              # Next.js "use client" entry
├── types.d.ts            # TypeScript declarations
├── dist/
│   └── styles.css        # 50-line CSS for glass-container/button
├── src/
│   ├── core/
│   │   ├── shapes.js     # Pure JS — GLSL fragment shader generators
│   │   ├── container.js  # <glass-container> autonomous CE (extends HTMLElement)
│   │   ├── button.js     # <glass-button> extends GlassContainer
│   │   └── index.js      # Registers CEs, re-exports API
│   └── components/
│       ├── GlassContainer.jsx  # React client wrapper (76 lines)
│       └── GlassButton.jsx     # React client wrapper (71 lines)
└── README.md
```

### How the React wrappers work

1. On mount, `ensureCEs()` checks if `'use client'` is a client component
2. If html2canvas isn't loaded, injects a `<script>` tag from CDN
3. Dynamically imports `liquid-glass/src/core/index.js` which registers `<glass-container>` and `<glass-button>` custom elements
4. Attributes (type, border-radius, tint-opacity, etc.) are synced via `useEffect` + `setAttribute`
5. `suppressHydrationWarning` on the host element prevents React hydration mismatches for unknown custom elements

### Key design decisions

- **Autonomous CEs** (not customized built-ins) — works in Safari
- **`shapes.js`** is a pure-JS module with no browser APIs — breaks the circular import between container and button
- **Container never imports Button** — shape detection uses `tagName === 'glass-container'` string checks, not `instanceof`
- **Static snapshot sharing** — `GlassContainer.pageSnapshot` is captured once per page, shared across all instances
- **Snapshot retry** — if `html2canvas` fails (CORS, taint), retries once after 1 second

---

## Bugs Fixed from the Original

This library was built while reverse-engineering [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js) and its Web Component conversion PR. Every bug found during code review was fixed:

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| `tintOpacity` attribute broken | `Number.isNaN(string)` always returns `false`; callback discarded the result | `parseTint()` with `Number()` + `isFinite` + 0–1 clamp; callback assigns `this.tintOpacity` |
| Circular import `container ↔ button` | `container.js` imported `Button` for `instanceof` | Extracted GLSL to `shapes.js`; container uses `tagName` string comparison |
| `capturePageSnapshot` race condition | New containers pushed mid-capture never drained | `.then()` callback drains queue and any extras queued during capture |
| Safari broken | Used customized built-in CEs (`is="glass-container"`) | Switched to autonomous CEs (`<glass-container>`) |
| `setupAsNestedGlass` passes empty image | Called `initWebGL({})` with `{}` as image source | `_setupNestedShader` initializes texture with correct parent canvas dimensions |
| `onClick` JS API removed | Web Component conversion removed constructor callback option | `create({ onClick })` uses `addEventListener("click", ...)` |
| No cleanup on disconnect | Instances leaked in `Container.instances` forever; no WebGL resource deletion | `disconnectedCallback` removes from tracking, cancels rAF, deletes textures/buffers/programs |
| No SSR guard | `window.addEventListener` + `customElements.define` at module top-level | All guarded by `typeof window !== "undefined"` |
| No WebGL context recovery | Lost contexts broke rendering permanently | `webglcontextlost` / `webglcontextrestored` listeners with re-init |
| `tintOpacity` parsing edge cases | `null`, `""`, negative values handled incorrectly | `parseTint` handles all edge cases: `null → 0.2`, `"" → 0.2`, `-0.1 → 0`, `1.5 → 1`, `"abc" → 0.2` |
| `attributeChangedCallback` on Button | Called `super.attributeChangedCallback` which looked for parent on prototype chain | Fixed — `super.attributeChangedCallback` resolves to `GlassContainer.prototype.attributeChangedCallback` (exists) |

---

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 80+ | ✅ Full support |
| Firefox | 75+ | ✅ Full support |
| Safari | 14+ | ✅ Full support |
| Edge | 80+ | ✅ Full support |

Requirements: WebGL 2.0, ES6+ modules.

---

## TypeScript

Full type declarations included at `types.d.ts`. The package exposes two module paths:

```ts
// Core API (custom elements)
import { GlassContainer, GlassButton } from "liquid-glass"

// React components
import { GlassContainer, GlassButton } from "liquid-glass/react"
```

---

## License

MIT — based on the original [dashersw/liquid-glass-js](https://github.com/dashersw/liquid-glass-js).

---

## Acknowledgments

- **Armagan Amcalar** ([@dashersw](https://github.com/dashersw)) — original Liquid Glass JS library and WebGL shader work
- Apple's Liquid Glass design language — the visual inspiration
- html2canvas — page capture for background sampling
