'use client'
// ┌───────────────────────────────────────────────┐
// │  Liquid Glass — <GlassButton> for Next.js     │
// └───────────────────────────────────────────────┘

import { useRef, useEffect } from 'react'

// Shared init is in GlassContainer — both share the same _initState
let _initState = 'idle'

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(src))
    document.head.appendChild(s)
  })
}

function ensureCEs() {
  if (typeof window === 'undefined') return
  if (_initState === 'ready') return
  if (_initState !== 'idle') return
  _initState = 'loading_h2c'
  const h2cReady = window.html2canvas
    ? Promise.resolve()
    : loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
  h2cReady.then(() => {
    _initState = 'loading_ce'
    import('liquid-glass/src/core/index.js').catch(() =>
      import('../core/index.js')
    ).then(() => { _initState = 'ready' }).catch(console.warn)
  }).catch(err => { console.warn('Liquid Glass: init failed', err); _initState = 'idle' })
}

function setAttr(el, name, value) {
  if (value === undefined || value === null || value === false) el.removeAttribute(name)
  else el.setAttribute(name, String(value))
}

export function GlassButton({
  text = 'Button', size = 48, type = 'rounded', tintOpacity = 0.2, warp = false,
  onClick, style, className,
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
    <glass-button ref={ref} className={className} style={style} suppressHydrationWarning />
  )
}

GlassButton.displayName = 'GlassButton'
