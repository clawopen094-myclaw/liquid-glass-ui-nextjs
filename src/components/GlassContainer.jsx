'use client'
// ┌───────────────────────────────────────────────┐
// │  Liquid Glass — <GlassContainer> for Next.js  │
// │  SSR-safe. Loads custom elements on mount.    │
// └───────────────────────────────────────────────┘

import { useRef, useEffect, useCallback } from 'react'

// ── lazy-load custom elements (browser-only) ──
let _loading = false
let _ready = false

function ensureCEs() {
  if (typeof window === 'undefined') return
  if (_ready || _loading) return
  _loading = true

  // 1. html2canvas global
  if (!window.html2canvas) {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    s.async = true
    document.head.appendChild(s)
  }

  // 2. Import CEs (side-effect: registers <glass-container> + <glass-button>)
  import('liquid-glass/src/core/index.js').catch(() =>
    import('../core/index.js')
  ).then(() => { _ready = true }).catch(console.warn)
}

// ── helpers ──
function setAttr(el, name, value) {
  if (value === undefined || value === null || value === false) el.removeAttribute(name)
  else el.setAttribute(name, String(value))
}

// ── component ──
export function GlassContainer({
  type = 'rounded',
  borderRadius = 48,
  tintOpacity = 0.2,
  warp = false,
  style,
  className,
  children,
  onRef,
}) {
  const ref = useRef(null)

  useEffect(() => { ensureCEs() }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setAttr(el, 'type', type)
    setAttr(el, 'border-radius', borderRadius)
    setAttr(el, 'tint-opacity', tintOpacity)
    setAttr(el, 'warp', warp || undefined)
  }, [type, borderRadius, tintOpacity, warp])

  const mergedRef = useCallback((node) => { ref.current = node; if (onRef) onRef(node) }, [onRef])

  return (
    <glass-container
      ref={mergedRef}
      className={className}
      style={style}
      suppressHydrationWarning
    >
      {children}
    </glass-container>
  )
}

GlassContainer.displayName = 'GlassContainer'
