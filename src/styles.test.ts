// @vitest-environment jsdom

import { createElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PalettePreview } from "./components/PalettePreview";

vi.mock("./lib/bridge", () => ({
  closePalettePreview: vi.fn(async () => {}),
  listenPaletteController: vi.fn(async () => () => {}),
  updatePalettePreview: vi.fn(async () => {}),
}));

describe("palette preview typography", () => {
  it("keeps the compact description styles away from the animated percentage", () => {
    const view = render(createElement(PalettePreview));
    const description = view.getByText("拖动查看 0%–100% 的背景效果");
    const animatedValue = view.container.querySelector("output span");

    expect(description.classList.contains("palette-preview__description")).toBe(true);
    expect(animatedValue?.classList.contains("palette-preview__description")).toBe(false);
  });
});
