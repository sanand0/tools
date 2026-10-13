import { afterAll, describe, expect, it, vi } from "vitest";
import { Browser } from "happy-dom";
import { readFileSync } from "node:fs";
import { loadFrom } from "../common/testutils.js";

const source = readFileSync(new URL("bookmarklet.js", import.meta.url), "utf8");
const browser = new Browser({ console });
afterAll(() => browser.close());

const openSite = (url = "https://news.ycombinator.com/item?id=1") => {
  const page = browser.newPage();
  page.mainFrame.url = url;
  const { window, document } = page.mainFrame;
  document.write(`<!doctype html><html><head><style>body{background:white;color:black}.noshow{display:none}</style></head>
    <body><table id="hnmain" bgcolor="#f6f6ef"><tr><td><a href="#" id="collapse">[-]</a>
    <div class="comment"><span class="commtext cdd">Muted comment</span></div></td></tr></table>
    <textarea>Unsaved reply</textarea></body></html>`);
  document.getElementById("collapse").addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelector(".comment").classList.toggle("noshow");
  });
  return { page, window, document };
};

describe("darkmode bookmarklet", () => {
  it("toggles repeatedly, restores original markup, and preserves interactive state", () => {
    const { window, document } = openSite();
    const original = document.documentElement.outerHTML;
    for (let i = 0; i < 3; i++) {
      window.eval(source);
      expect(document.querySelectorAll("#tools-darkmode-style")).toHaveLength(1);
      expect(window.getComputedStyle(document.body).backgroundColor).toBe("#141414");
      expect(window.getComputedStyle(document.querySelector(".cdd")).color).toBe("#b8b8b8");
      window.eval(source);
      expect(document.documentElement.outerHTML).toBe(original);
      expect(window.getComputedStyle(document.body).backgroundColor).toBe("white");
    }
    window.eval(source);
    document.getElementById("collapse").click();
    expect(window.getComputedStyle(document.querySelector(".comment")).display).toBe("none");
    document.querySelector("textarea").value = "New draft";
    window.eval(source);
    expect(document.querySelector("textarea").value).toBe("New draft");
    expect(document.querySelector(".comment").classList.contains("noshow")).toBe(true);
  });

  it("themes dynamically added comments and controls without rewriting them", () => {
    const { window, document } = openSite();
    window.eval(source);
    document.body.insertAdjacentHTML("beforeend", '<span class="commtext c00">New comment</span><input placeholder="Search">');
    expect(window.getComputedStyle(document.querySelector(".c00")).color).toBe("#c8c8c8");
    expect(window.getComputedStyle(document.querySelector("input")).backgroundColor).toBe("#292929");
    window.eval(source);
    expect(document.querySelector(".c00").textContent).toBe("New comment");
  });

  it("keeps text palettes above 4.5:1 contrast, including muted comments and controls", () => {
    const { window, document } = openSite();
    const classes = ["c00", "c5a", "c73", "c82", "c88", "c9c", "cae", "cbe", "cce", "cdd", "subtext", "comhead"];
    for (const name of classes) {
      const span = document.createElement("span");
      span.className = name;
      span.textContent = "Text";
      document.body.append(span);
    }
    window.eval(source);
    const luminance = (hex) => hex.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (foreground, background) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
      return (values[1] + 0.05) / (values[0] + 0.05);
    };
    for (const name of classes) {
      expect(contrast(window.getComputedStyle(document.querySelector(`.${name}`)).color, "#202020")).toBeGreaterThanOrEqual(4.5);
    }
    const control = window.getComputedStyle(document.querySelector("textarea"));
    expect(contrast(control.color, control.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    const css = document.getElementById("tools-darkmode-style").textContent;
    for (const color of ["#9dcbff", "#bca9de", "#ffbd80"]) {
      expect(css).toContain(color);
      expect(contrast(color, "#202020")).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast("#141414", "#ff6600")).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["https://example.com/", "https://news.ycombinator.com.evil.test/", "https://ycombinator.com/"])(
    "leaves unsupported host %s unchanged", (url) => {
      const { window, document } = openSite(url);
      window.alert = vi.fn();
      const original = document.documentElement.outerHTML;
      window.eval(source);
      expect(document.documentElement.outerHTML).toBe(original);
      expect(window.alert).toHaveBeenCalledOnce();
    },
  );

  it("loads the installation page and executes the actual encoded bookmark URL", async () => {
    const { document, page } = await loadFrom(new URL(".", import.meta.url).pathname);
    const link = document.getElementById("bookmarklet");
    expect(link.classList.contains("disabled")).toBe(false);
    expect(document.getElementById("bookmarklet-spinner").classList.contains("d-none")).toBe(true);
    expect(link.href.startsWith("javascript:")).toBe(true);
    const { window, document: site } = openSite("https://news.ycombinator.com/login");
    const code = decodeURIComponent(link.href.slice("javascript:".length));
    expect(window.eval(code)).toBeUndefined();
    expect(site.getElementById("tools-darkmode-style")).not.toBeNull();
    window.eval(code);
    expect(site.getElementById("tools-darkmode-style")).toBeNull();
    await page.close();
  });
});
