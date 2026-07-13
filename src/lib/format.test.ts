import { describe, expect, it } from "vitest";
import { clampPercent, formatCompactTokens, formatResetDate, formatResetTime, getPrimaryQuota, needsFastRefresh, quotaTier } from "./format";

describe("quota formatting", () => {
  it("clamps untrusted percentages", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(51.6)).toBe(52);
    expect(clampPercent(140)).toBe(100);
  });

  it("formats cumulative token totals with stable compact units", () => {
    expect(formatCompactTokens(0)).toBe("0");
    expect(formatCompactTokens(999)).toBe("999");
    expect(formatCompactTokens(1_250)).toBe("1.3K");
    expect(formatCompactTokens(999_999)).toBe("1M");
    expect(formatCompactTokens(12_458_320)).toBe("12.5M");
  });

  it("uses inclusive 50% and 10% quota boundaries", () => {
    expect(quotaTier(50)).toBe("healthy");
    expect(quotaTier(49)).toBe("caution");
    expect(quotaTier(10)).toBe("caution");
    expect(quotaTier(9)).toBe("critical");
    expect(quotaTier(null)).toBe("unknown");
  });

  it("prefers the short window and falls back to the weekly window", () => {
    const base = { provider: "codex", displayName: "CODEX", plan: "PLUS", resetCredits: 0, updatedAt: "2026-07-13T00:00:00Z", status: "ok", message: null } as const;
    const shortWindow = { remainingPercent: 75, resetsAt: null, windowSeconds: 18_000 };
    const weeklyWindow = { remainingPercent: 99, resetsAt: null, windowSeconds: 604_800 };

    expect(getPrimaryQuota({ ...base, shortWindow, weeklyWindow })).toEqual({ kind: "short", window: shortWindow });
    expect(getPrimaryQuota({ ...base, shortWindow: null, weeklyWindow })).toEqual({ kind: "weekly", window: weeklyWindow });
    expect(getPrimaryQuota({ ...base, shortWindow: null, weeklyWindow: null })).toBeNull();
  });

  it("formats reset time in Chinese by default and supports English", () => {
    const now = new Date("2026-07-07T00:00:00Z");
    expect(formatResetTime("2026-07-07T01:30:00Z", now)).toBe("1 小时 30 分钟后重置");
    expect(formatResetTime("2026-07-07T01:30:00Z", now, "zh-CN")).toBe("1 小时 30 分钟后重置");
    expect(formatResetTime("2026-07-07T01:30:00Z", now, "en")).toBe("resets in 1h 30m");
    expect(formatResetTime("2026-07-06T01:00:00Z", now)).toBe("正在更新额度");
    expect(formatResetTime("2026-07-06T01:00:00Z", now, "zh-CN")).toBe("正在更新额度");
    expect(formatResetTime("2026-07-06T01:00:00Z", now, "en")).toBe("Updating quota");
    expect(formatResetTime("invalid", now)).toBe("重置时间未知");
    expect(formatResetTime("invalid", now, "zh-CN")).toBe("重置时间未知");
    expect(formatResetTime("invalid", now, "en")).toBe("Reset time unknown");
  });

  it("accelerates only near a future reset", () => {
    const now = new Date("2026-07-07T00:00:00Z");
    const snapshot = { provider: "codex", displayName: "CODEX", plan: "PRO", weeklyWindow: null, resetCredits: 0, updatedAt: now.toISOString(), status: "ok", message: null } as const;
    expect(needsFastRefresh({ ...snapshot, shortWindow: { remainingPercent: 1, resetsAt: "2026-07-07T00:10:00Z", windowSeconds: 18000 } }, now)).toBe(true);
    expect(needsFastRefresh({ ...snapshot, shortWindow: { remainingPercent: 1, resetsAt: "2026-07-07T01:00:00Z", windowSeconds: 18000 } }, now)).toBe(false);
    expect(needsFastRefresh({ ...snapshot, shortWindow: { remainingPercent: 1, resetsAt: "2026-07-06T23:58:00Z", windowSeconds: 18000 } }, now)).toBe(true);
  });

  it("formats the weekly reset as a compact date", () => {
    expect(formatResetDate("2026-07-10T00:00:00+08:00")).toBe("7/10");
    expect(formatResetDate("2026-07-10T00:00:00+08:00", "en")).toBe("7/10");
    expect(formatResetDate(null)).toBe("日期未知");
    expect(formatResetDate(null, "zh-CN")).toBe("日期未知");
    expect(formatResetDate(null, "en")).toBe("Date unknown");
  });
});
