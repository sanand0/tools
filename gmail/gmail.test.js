import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import { Browser } from "happy-dom";
import { loadFrom } from "../common/testutils.js";

const scriptSource = await fs.readFile(path.join(import.meta.dirname, "gmail.js"), "utf8");
const fixtureSource = await fs.readFile(path.join(import.meta.dirname, "__fixtures__/open-thread.html"), "utf8");
const browser = new Browser({ console });

describe("GMail header bookmarklet", () => {
  let page;
  let window;
  let document;

  beforeEach(async () => {
    page = browser.newPage();
    page.mainFrame.document.open();
    page.mainFrame.document.write(fixtureSource);
    page.mainFrame.document.close();
    await page.waitUntilComplete();
    ({ window, document } = page.mainFrame);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue() },
      configurable: true,
    });
    window.eval(scriptSource);
    window.alert = vi.fn();
  });

  afterEach(() => page.close());

  it("extracts every expanded message sender after the subject", () => {
    expect(window.gmail.extractHeader(document)).toBe(
      [
        "Subject: Meeting Notes for Project X",
        "From: Old Sender <old.sender@example.com>",
        "From: John Doe <john.doe@example.com>",
      ].join("\n"),
    );
  });

  it("does not depend on Gmail's generated CSS classes", () => {
    document.querySelectorAll("[class]").forEach((element) => element.removeAttribute("class"));

    expect(window.gmail.extractHeader(document)).toContain("From: John Doe <john.doe@example.com>");
  });

  it("copies the header to the clipboard", async () => {
    await window.gmail.copyHeader();

    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
      [
        "Subject: Meeting Notes for Project X",
        "From: Old Sender <old.sender@example.com>",
        "From: John Doe <john.doe@example.com>",
      ].join("\n"),
    );
  });

  it("shows a notification for five seconds after copying", async () => {
    let dismiss;
    document.body.insertAdjacentHTML = vi.fn(() => {
      throw new TypeError("This document requires 'TrustedHTML' assignment.");
    });
    window.setTimeout = vi.fn((callback) => {
      dismiss = callback;
      return 1;
    });

    await window.gmail.copyHeader();

    const notification = document.querySelector("[data-gmail-notification]");
    expect(notification?.textContent).toBe("GMail header copied.");
    expect(notification?.getAttribute("role")).toBe("status");
    expect(notification?.getAttribute("aria-live")).toBe("polite");
    expect(notification?.style.position).toBe("fixed");
    expect(notification?.style.zIndex).toBe("2147483647");
    expect(document.body.insertAdjacentHTML).not.toHaveBeenCalled();
    expect(window.setTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);

    dismiss();
    expect(document.querySelector("[data-gmail-notification]")).toBeNull();
  });

  it("preserves hyphens in the subject", () => {
    document.title = "Meeting Notes - Project X - root.node@gmail.com - Gmail";

    expect(window.gmail.extractHeader(document)).toContain("Subject: Meeting Notes - Project X");
  });

  it("fails clearly when no expanded email is open", () => {
    document.querySelectorAll('[role="listitem"]').forEach((element) => element.remove());

    expect(() => window.gmail.extractHeader(document)).toThrow("Open an email in GMail first.");
  });

  it("does not write to the clipboard when no expanded email is open", async () => {
    document.querySelectorAll('[role="listitem"]').forEach((element) => element.remove());

    await window.gmail.copyHeader();

    expect(window.navigator.clipboard.writeText).not.toHaveBeenCalled();
    expect(window.alert).toHaveBeenCalledWith("Open an email in GMail first.");
  });
});

describe("GMail bookmarklets page", () => {
  it("loads a draggable GMail header bookmarklet", async () => {
    const { document } = await loadFrom(import.meta.dirname);
    const bookmarklet = document.querySelector('[data-bookmarklet="gmail-header"]');

    expect(bookmarklet?.textContent).toContain("GMail header");
    expect(bookmarklet?.getAttribute("href")).toMatch(/^javascript:/);
    expect(decodeURIComponent(bookmarklet.href)).toContain("gmail.copyHeader();");
    expect(document.getElementById("bookmarklet-spinner")?.classList).toContain("d-none");
  });
});
