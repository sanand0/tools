import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { loadFrom } from "../common/testutils.js";

describe("joincsv", () => {
  let window, document, tablesInput, joinBtn, output, copyBtn;

  beforeAll(() => vi.useFakeTimers());
  afterAll(() => vi.useRealTimers());

  beforeEach(async () => {
    ({ window, document } = await loadFrom(import.meta.dirname));
    window.setTimeout = setTimeout;
    tablesInput = document.getElementById("tables");
    joinBtn = document.getElementById("joinBtn");
    output = document.getElementById("output");
    copyBtn = document.getElementById("copyBtn");
  });
  afterEach(() => vi.restoreAllMocks());

  it("joins tables and copies", async () => {
    tablesInput.value = "id,a\n1,x\n\n\nid,b\n1,y";
    joinBtn.click();
    expect(output.value.trim()).toBe("id,a,b\n1,x,y");
    copyBtn.click();
    expect(await window.navigator.clipboard.readText()).toBe("id\ta\tb\n1\tx\ty");
  });
});
