"use client";

import * as React from "react";

/** Shared across every component that gates a framer-motion transition behind the OS-level reduced-motion preference. */
export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = window.requestAnimationFrame(() => setPrefers(query.matches));
    const onChange = () => setPrefers(query.matches);
    query.addEventListener("change", onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      query.removeEventListener("change", onChange);
    };
  }, []);

  return prefers;
}
