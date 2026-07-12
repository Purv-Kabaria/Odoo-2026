"use client"

import * as React from "react"
import type { AnimationItem } from "lottie-web/build/player/lottie_light"

type LottieLightPlayerProps = {
  src: string
  loop?: boolean
  autoplay?: boolean
  className?: string
}

/**
 * Uses lottie-web's "light" build (no expressions engine) instead of
 * @lottiefiles/react-lottie-player's default full build — the full build's
 * expressions engine calls `eval`, which the production CSP's `script-src`
 * (deliberately no 'unsafe-eval') blocks, so the animation silently failed
 * to render outside of dev mode.
 */
export function LottieLightPlayer({ src, loop = true, autoplay = true, className }: LottieLightPlayerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let anim: AnimationItem | undefined
    let cancelled = false

    void import("lottie-web/build/player/lottie_light").then(({ default: lottie }) => {
      if (cancelled || !container) return
      anim = lottie.loadAnimation({
        container,
        renderer: "svg",
        loop,
        autoplay,
        path: src,
      })
    })

    return () => {
      cancelled = true
      anim?.destroy()
    }
  }, [src, loop, autoplay])

  return <div ref={containerRef} className={className} />
}
