// ┌───────────────────────────────────────────────────────┐
// │  Liquid Glass — <glass-button> autonomous CE          │
// │  Extends GlassContainer. Browser-only.                 │
// └───────────────────────────────────────────────────────┘

import { GlassContainer } from './container.js'
import { buildNestedShader } from './shapes.js'

export class GlassButton extends GlassContainer {
  static observedAttributes = [...GlassContainer.observedAttributes, 'text', 'size']

  static create(opts = {}) {
    const el = document.createElement('glass-button')
    if (opts.type) el.setAttribute('type', opts.type)
    if (opts.text != null) el.setAttribute('text', String(opts.text))
    if (opts.size != null) el.setAttribute('size', String(opts.size))
    if (opts.tintOpacity != null) el.setAttribute('tint-opacity', String(opts.tintOpacity))
    if (opts.warp) el.setAttribute('warp', '')
    if (opts.onClick) el.addEventListener('click', () => opts.onClick(el.textContent || el.text))
    return el
  }

  constructor() {
    super()
    this.text = 'Button'
    this.fontSize = 48
    this._nested = false
    this._parentCE = null
    this._textEl = null
  }

  connectedCallback() {
    if (this._btnMounted) return super.connectedCallback()
    this._btnMounted = true

    this.classList.add('glass-button')
    if (this.getAttribute('type') === 'circle') this.classList.add('glass-btn-circle')

    this.text = this.getAttribute('text') ?? 'Button'
    this.fontSize = parseInt(this.getAttribute('size') ?? '48', 10) || 48

    this._textEl = document.createElement('div')
    this._textEl.className = 'glass-button-text'
    this._textEl.textContent = this.text
    this._textEl.style.fontSize = this.fontSize + 'px'
    this.appendChild(this._textEl)

    this._calcSize()

    super.connectedCallback()

    const p = this.parentElement
    if (p && p.tagName.toLowerCase() === 'glass-container') this._setupNested()
  }

  disconnectedCallback() {
    if (this._rafId) cancelAnimationFrame(this._rafId)
    super.disconnectedCallback()
  }

  attributeChangedCallback(name, oldVal, newVal) {
    super.attributeChangedCallback(name, oldVal, newVal)
    switch (name) {
      case 'text':
        this.text = newVal ?? 'Button'
        if (this._textEl) { this._textEl.textContent = this.text; this._calcSize() }
        break
      case 'size':
        this.fontSize = newVal ? parseInt(newVal, 10) || 48 : 48
        if (this._textEl) { this._textEl.style.fontSize = this.fontSize + 'px'; this._calcSize() }
        break
    }
  }

  _calcSize() {
    let w, h
    if (this.type === 'circle') {
      w = h = this.fontSize * 2.5
      this.borderRadius = w / 2
      Object.assign(this.style, {
        width: w + 'px', height: h + 'px',
        minWidth: w + 'px', minHeight: h + 'px',
        maxWidth: w + 'px', maxHeight: h + 'px'
      })
    } else if (this.type === 'pill') {
      const m = GlassButton._measure(this.text, this.fontSize)
      w = Math.ceil(m.width + this.fontSize * 2)
      h = Math.ceil(this.fontSize + this.fontSize * 1.2)
      this.borderRadius = h / 2
      Object.assign(this.style, {
        minWidth: w + 'px', minHeight: h + 'px',
        width: w + 'px', height: h + 'px',
        maxWidth: w + 'px', maxHeight: h + 'px'
      })
    } else {
      const m = GlassButton._measure(this.text, this.fontSize)
      w = Math.ceil(m.width + this.fontSize * 2)
      h = Math.ceil(this.fontSize + this.fontSize * 1.5)
      this.borderRadius = this.fontSize
      Object.assign(this.style, { minWidth: w + 'px', minHeight: h + 'px' })
    }

    this.style.borderRadius = this.borderRadius + 'px'
    if (this.canvas) this.canvas.style.borderRadius = this.borderRadius + 'px'

    if (this.type === 'circle' || this.type === 'pill') {
      this.width = w; this.height = h
      if (this.canvas) { this.canvas.width = w; this.canvas.height = h; this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px' }
    }
  }

  static _measure(text, fs) {
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    if (ctx) { ctx.font = fs + 'px system-ui'; return ctx.measureText(text) }
    return { width: 100 }
  }

  // ── nested glass ──

  _setupNested() {
    if (this._nested) return
    const p = this.parentElement
    if (!p || p.tagName.toLowerCase() !== 'glass-container') return
    this._nested = true; this._parentCE = p
    if (this.webglReady) this._initNested()
  }

  _initWebGL(img) {
    if (!this.gl) return
    if (this._nested) this._initNested()
    else super._initWebGL(img)
  }

  _initNested() {
    const p = this._parentCE
    if (!p || !p.webglReady) { setTimeout(() => this._initNested(), 100); return }
    this._setupNestedShader()
    this.webglReady = true
  }

  _setupNestedShader() {
    if (!this.gl || !this.canvas) return
    const gl = this.gl
    const { vsSource, fsSource } = buildNestedShader()
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
    const refs = {
      ...this.glRefs, gl, posBuf, texBuf, texture: gl.createTexture(),
      posLoc: gl.getAttribLocation(prog, 'a_position'), texLoc: gl.getAttribLocation(prog, 'a_texcoord'),
      resLoc: L('u_resolution'), texSizeLoc: L('u_textureSize'), blurLoc: L('u_blurRadius'), rLoc: L('u_borderRadius'),
      btnPosLoc: L('u_buttonPosition'), conPosLoc: L('u_containerPosition'), conSizeLoc: L('u_containerSize'),
      warpLoc: L('u_warp'), eiLoc: L('u_edgeIntensity'), riLoc: L('u_rimIntensity'), biLoc: L('u_baseIntensity'),
      edLoc: L('u_edgeDistance'), rdLoc: L('u_rimDistance'), bdLoc: L('u_baseDistance'),
      cbLoc: L('u_cornerBoost'), rpLoc: L('u_rippleEffect'), tintLoc: L('u_tintOpacity'), imgLoc: L('u_image'),
    }
    this.glRefs = refs

    const pc = this._parentCE?.canvas
    const pw = pc?.width || 100; const ph = pc?.height || 100
    gl.bindTexture(gl.TEXTURE_2D, refs.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, pw, ph, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.enableVertexAttribArray(refs.posLoc); gl.vertexAttribPointer(refs.posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuf); gl.enableVertexAttribArray(refs.texLoc); gl.vertexAttribPointer(refs.texLoc, 2, gl.FLOAT, false, 0, 0)

    const gc = window.__glassControls || {}
    gl.uniform2f(refs.resLoc, this.canvas.width, this.canvas.height)
    gl.uniform2f(refs.texSizeLoc, pw, ph)
    gl.uniform1f(refs.blurLoc, gc.blurRadius ?? 2)
    gl.uniform1f(refs.rLoc, this.borderRadius)
    gl.uniform1f(refs.warpLoc, this.warp ? 1 : 0)
    gl.uniform1f(refs.eiLoc, gc.edgeIntensity ?? 0.01)
    gl.uniform1f(refs.riLoc, gc.rimIntensity ?? 0.05)
    gl.uniform1f(refs.biLoc, gc.baseIntensity ?? 0.01)
    gl.uniform1f(refs.edLoc, gc.edgeDistance ?? 0.15)
    gl.uniform1f(refs.rdLoc, gc.rimDistance ?? 0.8)
    gl.uniform1f(refs.bdLoc, gc.baseDistance ?? 0.1)
    gl.uniform1f(refs.cbLoc, gc.cornerBoost ?? 0.02)
    gl.uniform1f(refs.rpLoc, gc.rippleEffect ?? 0.1)
    gl.uniform1f(refs.tintLoc, this.tintOpacity)

    if (this._parentCE) {
      const bp = this.getCenter(), cp = this._parentCE.getCenter()
      gl.uniform2f(refs.btnPosLoc, bp.x, bp.y); gl.uniform2f(refs.conPosLoc, cp.x, cp.y)
      gl.uniform2f(refs.conSizeLoc, this._parentCE.width, this._parentCE.height)
    }
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, refs.texture); gl.uniform1i(refs.imgLoc, 0)
    this._startNestedLoop()
  }

  _startNestedLoop() {
    const render = () => {
      if (!this.glRefs.gl || !this._parentCE) return
      const gl = this.glRefs.gl
      const pc = this._parentCE.canvas
      if (!pc) return
      gl.bindTexture(gl.TEXTURE_2D, this.glRefs.texture)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, pc)
      gl.clear(gl.COLOR_BUFFER_BIT)
      const bp = this.getCenter(), cp = this._parentCE.getCenter()
      gl.uniform2f(this.glRefs.btnPosLoc, bp.x, bp.y); gl.uniform2f(this.glRefs.conPosLoc, cp.x, cp.y)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      this._rafId = requestAnimationFrame(render)
    }
    render()
    this._render = () => render()
  }
}

if (typeof window !== 'undefined' && !window.customElements.get('glass-button'))
  window.customElements.define('glass-button', GlassButton)

export default GlassButton
