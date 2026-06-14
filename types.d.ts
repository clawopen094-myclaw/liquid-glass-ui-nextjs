// ┌───────────────────────────────────────────────┐
// │  Liquid Glass — TypeScript declarations        │
// └───────────────────────────────────────────────┘

declare module 'liquid-glass' {
  export class GlassContainer extends HTMLElement {
    static instances: GlassContainer[]
    static create(opts?: GlassContainerProps): GlassContainer
    width: number
    height: number
    borderRadius: number
    type: GlassShape
    tintOpacity: number
    warp: boolean
    webglReady: boolean
    refreshSize(): void
    getCenter(): { x: number; y: number }
  }

  export class GlassButton extends GlassContainer {
    static create(opts?: GlassButtonProps): GlassButton
    text: string
    fontSize: number
  }
}

declare module 'liquid-glass/react' {
  import { FC, CSSProperties, ReactNode } from 'react'

  type GlassShape = 'rounded' | 'circle' | 'pill'

  interface GlassContainerProps {
    type?: GlassShape
    borderRadius?: number
    tintOpacity?: number
    warp?: boolean
    style?: CSSProperties
    className?: string
    children?: ReactNode
    onRef?: (el: HTMLElement | null) => void
  }

  interface GlassButtonProps extends Omit<GlassContainerProps, 'children' | 'onRef'> {
    text?: string
    size?: number
    onClick?: () => void
  }

  export const GlassContainer: FC<GlassContainerProps>
  export const GlassButton: FC<GlassButtonProps>
}
