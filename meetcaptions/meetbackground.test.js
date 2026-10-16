import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Browser } from "happy-dom";

const script = await readFile(fileURLToPath(new URL("./meetbackground.js", import.meta.url)), "utf8");
const browser = new Browser({ console });
let page;
let window;
let document;

beforeEach(() => {
  page = browser.newPage();
  ({ window, document } = page.mainFrame);
  Object.defineProperty(window.location, "hostname", { value: "meet.google.com", configurable: true });
  window.alert = vi.fn();
});

afterEach(() => page.close());
afterAll(async () => browser.close());

describe("Meet MP4 background bookmarklet", () => {
  it("enables MP4 and opens the existing Google Meet background picker", () => {
    document.body.innerHTML = '<input type="file" accept="image/jpeg, image/png, image/webp" style="display:none">';
    const input = document.querySelector("input");
    const click = vi.spyOn(input, "click");

    window.eval(script);

    expect(input.accept.split(/\s*,\s*/)).toEqual(["image/jpeg", "image/png", "image/webp", "video/mp4"]);
    expect(click).toHaveBeenCalledOnce();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("does not add MP4 twice on repeated use", () => {
    document.body.innerHTML = '<input type="file" accept="image/png, video/mp4">';
    window.eval(script);
    window.eval(script);
    expect(document.querySelector("input").accept).toBe("image/png, video/mp4");
  });

  it("asks to open Backgrounds and effects when its upload input is absent", () => {
    document.body.innerHTML = '<input type="file" accept="application/pdf">';
    const input = document.querySelector("input");
    const click = vi.spyOn(input, "click");
    window.eval(script);
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Backgrounds and effects"));
    expect(input.accept).toBe("application/pdf");
    expect(click).not.toHaveBeenCalled();
  });

  it("does not modify file inputs outside Google Meet", () => {
    Object.defineProperty(window.location, "hostname", { value: "example.com", configurable: true });
    document.body.innerHTML = '<input type="file" accept="image/jpeg, image/png">';
    const input = document.querySelector("input");
    const click = vi.spyOn(input, "click");
    window.eval(script);
    expect(input.accept).toBe("image/jpeg, image/png");
    expect(click).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith(expect.stringContaining("Google Meet"));
  });
});
