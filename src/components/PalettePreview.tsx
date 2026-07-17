import { useEffect, useState } from "react";
import { closePalettePreview, listenPaletteController, updatePalettePreview } from "../lib/bridge";
import { clampPercent } from "../lib/format";
import { DEFAULT_PALETTE_COLORS, normalizePaletteColors, quotaThemeStyle } from "../lib/quotaTheme";
import { AnimatedNumber } from "./AnimatedNumber";

type MotionPhase = "closed" | "opening" | "open" | "closing";

export function PalettePreview() {
  const [percent, setPercent] = useState(100);
  const [colors, setColors] = useState<string[]>([...DEFAULT_PALETTE_COLORS]);
  const [motionPhase, setMotionPhase] = useState<MotionPhase>(() => "__TAURI_INTERNALS__" in window ? "closed" : "open");

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    void listenPaletteController({
      onOpened: (payload) => {
        setPercent(clampPercent(payload.percent));
        setColors(normalizePaletteColors(payload.colors));
        setMotionPhase("opening");
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => setMotionPhase("open")));
      },
      onClosing: () => setMotionPhase("closing"),
      onColorsChanged: (nextColors) => setColors(normalizePaletteColors(nextColors)),
    }).then((unlisten) => {
      if (cancelled) unlisten(); else cleanup = unlisten;
    });
    return () => { cancelled = true; cleanup(); };
  }, []);

  const update = (value: number) => {
    const next = clampPercent(value);
    setPercent(next);
    void updatePalettePreview(next);
  };

  return (
    <main className={`palette-preview palette-preview--${motionPhase}`} style={quotaThemeStyle(percent, colors)}>
      <div className="palette-preview__header">
        <div>
          <p>色彩预览</p>
          <span className="palette-preview__description">拖动查看 0%–100% 的背景效果</span>
        </div>
        <output htmlFor="palette-range" aria-live="polite" aria-label={`${percent}%`}><AnimatedNumber value={percent} />%</output>
      </div>
      <div className="palette-preview__controls">
        <input
          id="palette-range"
          className="palette-range"
          type="range"
          min="0"
          max="100"
          step="1"
          value={percent}
          aria-label="预览额度百分比"
          onChange={(event) => update(Number(event.target.value))}
        />
        <button type="button" onClick={() => void closePalettePreview()}>完成</button>
      </div>
    </main>
  );
}
