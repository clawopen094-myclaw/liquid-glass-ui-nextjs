'use client'
// ┌───────────────────────────────────────────────┐
// │  Liquid Glass — <GlassButton> for Next.js     │
// │  SSR-safe. Auto-detects nested glass.         │
// └───────────────────────────────────────────────┘

import { useRef, useEffect } from 'react'

let _loading = false
let _ready = false

function ensureCEs() {
  if (typeof window === 'undefined') return
  if (_ready || _loading) return
  _loading = true
  if (!window.html2canvas) {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    s.async = true
    document.head.appendChild(s)
  }
  import('liquid-glass/src/core/index.js').catch(() =>
    import('../core/index.js')
  ).then(() => { _ready = true }).catch(console.warn)
}

function setAttr(el, name, value) {
  if (value === undefined || value === null || value === false) el.removeAttribute(name)
  else el.setAttribute(name, String(value))
}

export function GlassButton({
  text = 'Button',
  size = 48,
  type = 'rounded',
  tintOpacity = 0.2,
  warp = false,
  onClick,
  style,
  className,
}) {
  const ref = useRef(null)

  useEffect(() => { ensureCEs() }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    setAttr(el, 'text', text)
    setAttr(el, 'size', size)
    setAttr(el, 'type', type)
    setAttr(el, 'tint-opacity', tintOpacity)
    setAttr(el, 'warp', warp || undefined)
  }, [text, size, type, tintOpacity, warp])

  useEffect(() => {
    const el = ref.current
    if (el && onClick) { el.addEventListener('click', onClick); return () => el.removeEventListener('click', onClick) }
  }, [onClick])

  return (
    <glass-button
      ref={ref}
      className={className}
      style={style}
      suppressHydrationWarning
    />
  )
}

GlassButton.displayName = 'GlassButton'
