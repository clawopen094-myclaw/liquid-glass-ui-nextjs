'use client'
import { useRef, useEffect, useCallback } from 'react'

function getState() { return window.__lgInitState || 'idle' }
function setState(s) { window.__lgInitState = s }

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject(new Error('SSR'))
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error(src))
    document.head.appendChild(s)
  })
}

function ensureCEs() {
  if (typeof window === 'undefined') return
  if (getState() !== 'idle') return
  setState('loading_h2c')
  const h2cReady = window.html2canvas
    ? Promise.resolve()
    : loadScript('https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js')
  h2cReady.then(() => {
    setState('loading_ce')
    import('liquid-glass/src/core/index.js').catch(() =>
      import('../core/index.js')
    ).then(() => { setState('ready') }).catch(console.warn)
  }).catch(err => { console.warn('Liquid Glass: init failed', err); setState('idle') })
}

function setAttr(el, name, value) {
  if (value === undefined || value === null || value === false) el.removeAttribute(name)
  else el.setAttribute(name, String(value))
}

export function GlassContainer({
  type = 'rounded', borderRadius = 48, tintOpacity = 0.2, warp = false,
  style, className, children, onRef,
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
    <glass-container ref={mergedRef} className={className} style={style} suppressHydrationWarning>
      {children}
    </glass-container>
  )
}
GlassContainer.displayName = 'GlassContainer'
