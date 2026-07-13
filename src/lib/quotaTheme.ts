import type { CSSProperties } from "react";
import { clampPercent } from "./format";

export const PALETTE_PERCENTAGES = [0, 25, 50, 75, 100] as const;
export const DEFAULT_PALETTE_COLORS = ["#eb5b58", "#f1a06f", "#f5d98f", "#e3f4b8", "#b9e4c9"] as const;

type ThemeVariable =
  | "--card-base"
  | "--card-foreground"
  | "--card-muted"
  | "--cool"
  | "--glow"
  | "--warm"
  | "--mid"
  | "--linear-warm"
  | "--linear-end"
  | "--progress-start"
  | "--progress-end"
  | "--aurora-opacity"
  | "--palette-track";

export type QuotaThemeStyle = CSSProperties & Record<ThemeVariable, string>;

function normalizeHex(color: string): string | null {
  const normalized = color.trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(normalized) ? normalized : null;
}

export function normalizePaletteColors(colors?: readonly string[] | null): string[] {
  if (!colors || colors.length !== PALETTE_PERCENTAGES.length) return [...DEFAULT_PALETTE_COLORS];
  const normalized = colors.map(normalizeHex);
  return normalized.every((color): color is string => color !== null) ? normalized : [...DEFAULT_PALETTE_COLORS];
}

function colorChannels(color: string): [number, number, number] {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function channelsToHex(channels: readonly number[]): string {
  return `#${channels.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;
}

function interpolateHex(from: string, to: string, amount: number): string {
  const start = colorChannels(from);
  const end = colorChannels(to);
  return channelsToHex(start.map((value, index) => value + (end[index] - value) * amount));
}

function mixHex(color: string, target: string, amount: number): string {
  return interpolateHex(color, target, amount);
}

export function paletteColorAt(percent: number, colors?: readonly string[] | null): string {
  const palette = normalizePaletteColors(colors);
  const value = clampPercent(percent);
  const upperIndex = PALETTE_PERCENTAGES.findIndex((stop) => value <= stop);
  const safeUpperIndex = Math.max(0, upperIndex);
  const lowerIndex = Math.max(0, safeUpperIndex - 1);
  const lowerPercent = PALETTE_PERCENTAGES[lowerIndex];
  const upperPercent = PALETTE_PERCENTAGES[safeUpperIndex];
  const amount = upperPercent === lowerPercent ? 0 : (value - lowerPercent) / (upperPercent - lowerPercent);
  return interpolateHex(palette[lowerIndex], palette[safeUpperIndex], amount);
}

export function paletteGradient(colors?: readonly string[] | null): string {
  const palette = normalizePaletteColors(colors);
  return `linear-gradient(90deg, ${palette.map((color, index) => `${color} ${PALETTE_PERCENTAGES[index]}%`).join(", ")})`;
}

export function paletteValidationError(colors: readonly string[]): string | null {
  if (colors.length !== PALETTE_PERCENTAGES.length || colors.some((color) => normalizeHex(color) === null)) {
    return "请选择五个有效颜色。";
  }
  const renderedColors = Array.from({ length: 101 }, (_, percent) => paletteColorAt(percent, colors));
  if (new Set(renderedColors).size !== renderedColors.length) {
    return "部分阶段颜色过于接近，请调整后再应用。";
  }
  return null;
}

function relativeLuminance(color: string): number {
  const channels = colorChannels(color).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function quotaThemeStyle(percent: number, colors?: readonly string[] | null): QuotaThemeStyle {
  const value = clampPercent(percent);
  const base = paletteColorAt(value, colors);
  const useLightForeground = relativeLuminance(base) < 0.18;
  const foreground = useLightForeground ? "#ffffff" : "#17191f";
  const muted = useLightForeground ? "rgba(255,255,255,.76)" : "rgba(23,25,31,.62)";

  return {
    "--card-base": base,
    "--card-foreground": foreground,
    "--card-muted": muted,
    "--cool": mixHex(base, "#7497c8", 0.18),
    "--glow": mixHex(base, "#ffffff", 0.42),
    "--warm": mixHex(base, "#ff754f", 0.16),
    "--mid": mixHex(base, "#d5d9dc", 0.2),
    "--linear-warm": mixHex(base, "#ffffff", 0.22),
    "--linear-end": mixHex(base, "#ffffff", 0.45),
    "--progress-start": mixHex(base, "#121821", 0.38),
    "--progress-end": mixHex(base, "#ffffff", 0.16),
    "--aurora-opacity": (0.88 - value * 0.0038).toFixed(3),
    "--palette-track": paletteGradient(colors),
  };
}
