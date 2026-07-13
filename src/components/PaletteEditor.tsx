import { useEffect, useState } from "react";
import { listenPaletteController, savePaletteColors, updatePaletteColors } from "../lib/bridge";
import {
  DEFAULT_PALETTE_COLORS,
  normalizePaletteColors,
  PALETTE_PERCENTAGES,
  paletteValidationError,
  quotaThemeStyle,
} from "../lib/quotaTheme";

export function PaletteEditor() {
  const [colors, setColors] = useState<string[]>([...DEFAULT_PALETTE_COLORS]);
  const [message, setMessage] = useState("");
  const validationError = paletteValidationError(colors);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    void listenPaletteController({
      onOpened: (payload) => {
        setColors(normalizePaletteColors(payload.colors));
        setMessage("");
      },
      onColorsChanged: (nextColors) => setColors(normalizePaletteColors(nextColors)),
    }).then((unlisten) => {
      if (cancelled) unlisten(); else cleanup = unlisten;
    });
    return () => { cancelled = true; cleanup(); };
  }, []);

  const update = (index: number, color: string) => {
    const next = colors.map((value, currentIndex) => currentIndex === index ? color.toLowerCase() : value);
    setColors(next);
    setMessage("");
    void updatePaletteColors(next);
  };

  const reset = () => {
    const next = [...DEFAULT_PALETTE_COLORS];
    setColors(next);
    setMessage("已恢复默认预览，点击应用后保存。");
    void updatePaletteColors(next);
  };

  const apply = async () => {
    if (validationError) return;
    try {
      const preferences = await savePaletteColors(colors);
      setColors(normalizePaletteColors(preferences.paletteColors));
      setMessage("配色已应用。");
    } catch {
      setMessage("配色保存失败，请重试。");
    }
  };

  return (
    <main className="palette-editor" style={quotaThemeStyle(50, colors)}>
      <div className="palette-editor__header">
        <p>调色盘</p>
        <div className="palette-editor__actions">
          <button type="button" onClick={reset}>恢复默认</button>
          <button type="button" className="palette-editor__apply" onClick={() => void apply()} disabled={Boolean(validationError)}>应用</button>
        </div>
      </div>
      <fieldset className="palette-swatches">
        <legend className="sr-only">五个额度阶段颜色</legend>
        {PALETTE_PERCENTAGES.map((percent, index) => (
          <label key={percent} className="palette-swatch">
            <input
              type="color"
              value={colors[index]}
              aria-label={`${percent}% 阶段颜色`}
              onChange={(event) => update(index, event.target.value)}
            />
            <span>{percent}%</span>
          </label>
        ))}
      </fieldset>
      <p className="sr-only" role="status" aria-live="polite">{validationError ?? message}</p>
    </main>
  );
}
