import { useEffect, useRef, useState } from "react";

export function AnimatedNumber({ value, duration = 220, className }: { value: number; duration?: number; className?: string }) {
  const [displayed, setDisplayed] = useState(value);
  const displayedRef = useRef(value);

  useEffect(() => {
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reducedMotion || duration <= 0) {
      displayedRef.current = value;
      setDisplayed(value);
      return;
    }

    const startValue = displayedRef.current;
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const interpolated = Math.round(startValue + (value - startValue) * eased);
      const next = Math.min(Math.max(startValue, value), Math.max(Math.min(startValue, value), interpolated));
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  return <span className={className} aria-hidden="true">{displayed}</span>;
}
