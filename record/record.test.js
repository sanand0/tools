import { describe, expect, it } from "vitest";

import { classifyLevel, formatFilename, peakDb } from "./script.js";

describe("record helpers", () => {
  it("formats local recording timestamps", () => {
    const date = new Date(2026, 8, 30, 15, 4, 5);
    expect(formatFilename(date)).toBe("2026-09-30-15-04-05.webm");
  });

  it("converts sample peaks to dBFS", () => {
    expect(peakDb(new Float32Array([0, 0.5, -0.25]))).toBeCloseTo(-6.0206, 3);
    expect(peakDb(new Float32Array([0, 0]))).toBe(-60);
  });

  it("classifies speech recording levels", () => {
    expect(classifyLevel(-32).label).toBe("Quiet");
    expect(classifyLevel(-20).label).toBe("Soft");
    expect(classifyLevel(-12).label).toBe("Good");
    expect(classifyLevel(-4).label).toBe("Hot");
    expect(classifyLevel(-0.5).label).toBe("Clipping");
  });
});
