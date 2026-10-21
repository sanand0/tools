import { describe, expect, it } from "vitest";

import {
  classifyLevel,
  codecLabel,
  dayLabel,
  formatBytes,
  formatFilename,
  peakDb,
  pickMimeType,
  recordingKind,
  slugify,
} from "./script.js";

describe("record helpers", () => {
  it("formats local recording timestamps", () => {
    const date = new Date(2026, 8, 30, 15, 4, 5);
    expect(formatFilename(date)).toBe("2026-09-30-15-04-05.webm");
    expect(formatFilename(date, { kind: "screen" })).toBe("2026-09-30-15-04-05-screen.webm");
    expect(formatFilename(date, { kind: "camera", title: "  Stand-up: Q3 plan! " })).toBe(
      "2026-09-30-15-04-05-camera-stand-up-q3-plan.webm",
    );
  });

  it("slugifies titles, keeping non-ASCII letters", () => {
    expect(slugify("Idée / café ")).toBe("idée-café");
    expect(slugify(" !! ")).toBe("");
  });

  it("infers the recording kind from filenames", () => {
    expect(recordingKind("2026-09-30-15-04-05.webm")).toBe("audio");
    expect(recordingKind("2026-09-30-15-04-05-camera.webm")).toBe("camera");
    expect(recordingKind("2026-09-30-15-04-05-screen-demo.webm")).toBe("screen");
    expect(recordingKind("2026-09-30-15-04-05-screenshots.webm")).toBe("audio");
  });

  it("prefers AV1, then VP9, then VP8 for video", () => {
    expect(pickMimeType(() => true, false)).toBe("audio/webm;codecs=opus");
    expect(pickMimeType(() => true, true)).toBe("video/webm;codecs=av01,opus");
    expect(pickMimeType((type) => !type.includes("av01"), true)).toBe("video/webm;codecs=vp9,opus");
    expect(codecLabel("video/webm;codecs=av01,opus")).toBe("AV1 + Opus");
  });

  it("labels library days", () => {
    const now = new Date(2026, 9, 21, 9, 0);
    expect(dayLabel(new Date(2026, 9, 21, 0, 5), now)).toBe("Today");
    expect(dayLabel(new Date(2026, 9, 20, 23, 55), now)).toBe("Yesterday");
    expect(dayLabel(new Date(2026, 9, 14), now)).not.toMatch(/2026/);
    expect(dayLabel(new Date(2025, 9, 14), now)).toMatch(/2025/);
  });

  it("formats byte sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(20_480)).toBe("20 KB");
    expect(formatBytes(3_250_000)).toBe("3.1 MB");
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
