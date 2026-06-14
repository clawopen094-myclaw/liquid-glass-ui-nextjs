// ┌───────────────────────────────────────────────────────┐
// │  Liquid Glass — <glass-container> autonomous CE       │
// │  Browser-only.  Load via next/dynamic({ ssr: false }).│
// │  Contains no import of button.js — fixes circular dep. │
// └───────────────────────────────────────────────────────┘

import { buildContainerShader } from './shapes.js'

const SHAPE_TYPES = new Set(['rounded', 'circle', 'pill'])

function parseTint(raw) {
  if (raw === null || raw === undefined || raw === '') return 0.2
  const n = Number(raw)
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.2
}

export class GlassContainer extends HTMLElement {
  static instances = []
  static pageSnapshot = null
  static isCapturing = false
  static waitingForSnapshot = []

  static observedAttributes = ['type', 'border-radius', 'tint-opacity', 'warp']

  /** JS constructor: GlassContainer.create({ type: 'pill', tintOpacity: 0.3 }) */
  static create(opts = {}) {
    const el = document.createElement('glass-container')
    if (opts.type) el.setAttribute('type', opts.type)
    if (opts.borderRadius != null) el.setAttribute('border-radius', String(opts.borderRadius))
    if (opts.tintOpacity != null) el.setAttribute('tint-opacity', String(opts.tintOpacity))
    if (opts.warp) el.setAttribute('warp', '')
    return el
  }

  constructor() {
    super()
    this.width = 0
    this.height = 0
    this.borderRadius = 48
    this.type = 'rounded'
    this.tintOpacity = 0.2
    this.warp = false
    this.canvas = null
    this.gl = null
    this.glRefs = {}
    this.webglReady = false
    this._scrollCb = null
    this._render = null
    this._rafId = null
  }

  connectedCallback() {
    if (this._mounted) return
    this._mounted = true
    this._parse()
    GlassContainer.instances.push(this)
    this._boot()
  }

  disconnectedCallback() {
    const i = GlassContainer.instances.indexOf(this)
    if (i > -1) GlassContainer.instances.splice(i, 1)
    if (this._rafId) cancelAnimationFrame(this._rafId)
    if (this._scrollCb) window.removeEventListener('scroll', this._scrollCb)
    if (this.gl) {
      try {
        const gl = this.gl
        if (this.glRefs.texture) gl.deleteTexture(this.glRefs.texture)
        if (this.glRefs.posBuf) gl.deleteBuffer(this.glRefs.posBuf)
        if (this.glRefs.texBuf) gl.deleteBuffer(this.glRefs.texBuf)
      } catch (_) {}
    }
    this.webglReady = false
  }

  attributeChangedCallback(name, _old, val) {
    if (!this._mounted) return
    switch (name) {
      case 'type':
        this.type = SHAPE_TYPES.has(val) ? val : 'rounded'
        this._applyTypeClass()
        break
      case 'border-radius':
        this.borderRadius = val ? parseInt(val, 10) || 48 : 48
        this.style.borderRadius = this.borderRadius + 'px'
        if (this.canvas) this.canvas.style.borderRadius = this.borderRadius + 'px'
        if (this.glRefs.rLoc && this.glRefs.gl)
          this.glRefs.gl.uniform1f(this.glRefs.rLoc, this.borderRadius)
        break
      case 'tint-opacity':
        this.tintOpacity = parseTint(val) // ← was broken, now fixed
        if (this.glRefs.tintLoc && this.glRefs.gl)
          this.glRefs.gl.uniform1f(this.glRefs.tintLoc, this.tintOpacity)
        break
      case 'warp':
        this.warp = val === '' || val === 'true'
        if (this.glRefs.warpLoc && this.glRefs.gl)
          this.glRefs.gl.uniform1f(this.glRefs.warpLoc, this.warp ? 1 : 0)
        break
    }
    if (this._render) this._render()
  }

  _parse() {
    const t = this.getAttribute('type')
    this.type = t && SHAPE_TYPES.has(t) ? t : 'rounded'
    const r = this.getAttribute('border-radius')
    this.borderRadius = r ? parseInt(r, 10) || 48 : 48
    this.tintOpacity = parseTint(this.getAttribute('tint-opacity'))
    this.warp = this.hasAttribute('warp')
  }

  _applyTypeClass() {
    this.classList.remove('glass-circle', 'glass-pill')
    if (this.type === 'circle') this.classList.add('glass-circle')
    else if (this.type === 'pill') this.classList.add('glass-pill')
  }

  // ── Boot: DOM + WebGL ──

  _boot() {
    this.classList.add('glass-container')
    this._applyTypeClass()
    this.style.borderRadius = this.borderRadius + 'px'

    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText =
      `position:absolute;top:0;left:0;width:100%;height:100%;` +
      `border-radius:${this.borderRadius}px;box-shadow:0 25px 50px rgba(0,0,0,0.25);z-index:-1`
    this.prepend(this.canvas)

    // Poll for html2canvas (CDN loads async).  Only create GL context once ready.
    const tryBoot = () => {
      if (typeof html2canvas === 'undefined') {
        setTimeout(tryBoot, 100)
        return
      }
      this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: true })
      if (!this.gl) return

      this.canvas.addEventListener('webglcontextlost', () => { this.webglReady = false })
      this.canvas.addEventListener('webglcontextrestored', () => {
        if (GlassContainer.pageSnapshot) this._initWebGL(GlassContainer.pageSnapshot)
      })

      requestAnimationFrame(() => this._updateSize())

      if (GlassContainer.pageSnapshot) {
        this._initWebGL(GlassContainer.pageSnapshot)
      } else if (GlassContainer.isCapturing) {
        GlassContainer.waitingForSnapshot.push(this)
      } else {
        GlassContainer.waitingForSnapshot.push(this)
        GlassContainer.capturePage()
      }
    }
    tryBoot()
  }

  _updateSize() {
    const r = this.getBoundingClientRect()
    let w = Math.ceil(r.width), h = Math.ceil(r.height)
    if (this.type === 'circle') {
      w = h = Math.max(w, h)
      this.borderRadius = w / 2
      this.style.width = w + 'px'; this.style.height = h + 'px'
    } else if (this.type === 'pill') {
      this.borderRadius = h / 2
    }
    this.style.borderRadius = this.borderRadius + 'px'
    this.width = w; this.height = h
    if (this.canvas) {
      this.canvas.width = w; this.canvas.height = h
      Object.assign(this.canvas.style, { width: w + 'px', height: h + 'px', borderRadius: this.borderRadius + 'px' })
    }
  }

  refreshSize() {
    requestAnimationFrame(() => {
      this._updateSize()
      if (this.glRefs.gl) {
        this.glRefs.gl.viewport(0, 0, this.width, this.height)
        this.glRefs.gl.uniform2f(this.glRefs.resLoc, this.width, this.height)
        this.glRefs.gl.uniform1f(this.glRefs.rLoc, this.borderRadius)
      }
    })
  }

  getCenter() {
    if (!this.canvas) return { x: 0, y: 0 }
    const r = this.canvas.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }

  // ── Snapshot (static) ──

  static capturePage(refresh = false) {
    if (GlassContainer.isCapturing) return
    GlassContainer.isCapturing = true
    GlassContainer.pageSnapshot = null

    html2canvas(document.body, {
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      ignoreElements(el) {
        return el.classList.contains('glass-container') ||
               el.classList.contains('glass-button') ||
               el.classList.contains('glass-button-text')
      }
    }).then(snap => {
      GlassContainer.pageSnapshot = snap
      GlassContainer.isCapturing = false
      // Pass canvas directly — no toDataURL() (tainted canvas from cross-origin images)
      const q = GlassContainer.waitingForSnapshot.splice(0)
      const extra = GlassContainer.waitingForSnapshot.splice(0)
      for (const c of [...q, ...extra]) {
        c.webglReady ? c._updateWebGL(snap) : c._initWebGL(snap)
        if (c._render) c._render()
      }
    }).catch(err => {
      console.error('Liquid Glass: snapshot failed', err)
      GlassContainer.isCapturing = false
      GlassContainer.waitingForSnapshot = []
    })
  }

  // ── WebGL ──

  _initWebGL(snapCanvas) {
    if (!snapCanvas) { console.warn('LG: _initWebGL missing snapCanvas'); return }
    if (!this.gl) { console.warn('LG: _initWebGL missing gl'); return }
    this._setupShader(snapCanvas)
  }

  _updateWebGL(snapCanvas) {
    const gl = this.glRefs.gl
    if (!gl || !this.glRefs.texture || !snapCanvas) return
    gl.bindTexture(gl.TEXTURE_2D, this.glRefs.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapCanvas)
    gl.uniform2f(this.glRefs.texSizeLoc, snapCanvas.width, snapCanvas.height)
  }

  _setupShader(snapCanvas) {
    if (!this.gl || !this.canvas || !snapCanvas) return
    const gl = this.gl
    const { vsSource, fsSource } = buildContainerShader()
    const prog = this._mkProgram(gl, vsSource, fsSource)
    if (!prog) return

    gl.useProgram(prog)

    const posBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW)

    const texBuf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,1,1,1,0,0,0,0,1,1,1,0]), gl.STATIC_DRAW)

    const L = (n) => gl.getUniformLocation(prog, n)
    this.glRefs = {
      gl, posBuf, texBuf,
      posLoc: gl.getAttribLocation(prog, 'a_position'),
      texLoc: gl.getAttribLocation(prog, 'a_texcoord'),
      texture: gl.createTexture(),
      resLoc: L('u_resolution'), texSizeLoc: L('u_textureSize'),
      scrollLoc: L('u_scrollY'), pageHLoc: L('u_pageHeight'), viewHLoc: L('u_viewportHeight'),
      blurLoc: L('u_blurRadius'), rLoc: L('u_borderRadius'),
      posCLoc: L('u_containerPosition'), warpLoc: L('u_warp'),
      eiLoc: L('u_edgeIntensity'), riLoc: L('u_rimIntensity'), biLoc: L('u_baseIntensity'),
      edLoc: L('u_edgeDistance'), rdLoc: L('u_rimDistance'), bdLoc: L('u_baseDistance'),
      cbLoc: L('u_cornerBoost'), rpLoc: L('u_rippleEffect'), tintLoc: L('u_tintOpacity'),
      imgLoc: L('u_image'),
    }
    const R = this.glRefs

    gl.bindTexture(gl.TEXTURE_2D, R.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapCanvas)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.clearColor(0, 0, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf)
    gl.enableVertexAttribArray(R.posLoc)
    gl.vertexAttribPointer(R.posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf)
    gl.enableVertexAttribArray(R.texLoc)
    gl.vertexAttribPointer(R.texLoc, 2, gl.FLOAT, false, 0, 0)

    const gc = window.__glassControls || {}
    gl.uniform2f(R.resLoc, this.canvas.width, this.canvas.height)
    gl.uniform2f(R.texSizeLoc, snapCanvas.width, snapCanvas.height)
    gl.uniform1f(R.blurLoc, gc.blurRadius ?? 5)
    gl.uniform1f(R.rLoc, this.borderRadius)
    gl.uniform1f(R.warpLoc, this.warp ? 1 : 0)
    gl.uniform1f(R.eiLoc, gc.edgeIntensity ?? 0.01)
    gl.uniform1f(R.riLoc, gc.rimIntensity ?? 0.05)
    gl.uniform1f(R.biLoc, gc.baseIntensity ?? 0.01)
    gl.uniform1f(R.edLoc, gc.edgeDistance ?? 0.15)
    gl.uniform1f(R.rdLoc, gc.rimDistance ?? 0.8)
    gl.uniform1f(R.bdLoc, gc.baseDistance ?? 0.1)
    gl.uniform1f(R.cbLoc, gc.cornerBoost ?? 0.02)
    gl.uniform1f(R.rpLoc, gc.rippleEffect ?? 0.1)
    gl.uniform1f(R.tintLoc, this.tintOpacity)

    const p = this.getCenter()
    gl.uniform2f(R.posCLoc, p.x, p.y)
    gl.uniform1f(R.pageHLoc, Math.max(document.body.scrollHeight, document.documentElement.scrollHeight))
    gl.uniform1f(R.viewHLoc, window.innerHeight)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, R.texture)
    gl.uniform1i(R.imgLoc, 0)

    this.webglReady = true
    this._startLoop()
  }

  _startLoop() {
    const render = () => {
      if (!this.glRefs.gl) return
      const gl = this.glRefs.gl
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(this.glRefs.scrollLoc, window.pageYOffset || document.documentElement.scrollTop)
      const p = this.getCenter()
      gl.uniform2f(this.glRefs.posCLoc, p.x, p.y)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    render()
    this._render = render
    this._scrollCb = () => render()
    window.addEventListener('scroll', this._scrollCb, { passive: true })
  }

  // ── helpers ──

  _mkProgram(gl, vsSrc, fsSrc) {
    const vs = this._compile(gl, gl.VERTEX_SHADER, vsSrc)
    const fs = this._compile(gl, gl.FRAGMENT_SHADER, fsSrc)
    if (!vs || !fs) return null
    const p = gl.createProgram()
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.error('LG link:', gl.getProgramInfoLog(p)); gl.deleteProgram(p); return null }
    gl.deleteShader(vs); gl.deleteShader(fs)
    return p
  }

  _compile(gl, type, src) {
    const s = gl.createShader(type)
    gl.shaderSource(s, src); gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.error('LG shader:', gl.getShaderInfoLog(s)); gl.deleteShader(s); return null }
    return s
  }
}

// ── Browser init block ──
if (typeof window !== 'undefined') {
  if (!window.customElements.get('glass-container'))
    window.customElements.define('glass-container', GlassContainer)

  let _rt
  window.addEventListener('resize', () => {
    clearTimeout(_rt)
    _rt = setTimeout(() => {
      GlassContainer.capturePage(true)
      GlassContainer.instances.forEach(c => c.refreshSize())
    }, 300)
  })
}
