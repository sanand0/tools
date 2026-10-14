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

const openGmail = (url = "https://mail.google.com/mail/u/1/#inbox/thread") => {
  const page = browser.newPage();
  page.mainFrame.url = url;
  const { window, document } = page.mainFrame;
  document.write(readFileSync(new URL("gmail.fixture.html", import.meta.url), "utf8"));
  return { page, window, document };
};

describe("Gmail message bodies", () => {
  it("themes the floating compose backdrop without changing its sticky state or controls", () => {
    const { window, document } = openGmail();
    const bar = document.querySelector(".aDj");
    const original = bar.outerHTML;
    window.eval(source);
    // Happy DOM does not render pseudo-elements; check the parsed rule here
    // and verify the actual backdrop and scrolling in Chromium.
    const rule = [...document.getElementById("tools-darkmode-style").sheet.cssRules]
      .find(({ selectorText }) => selectorText === ".iY .aDj::after");
    expect(bar.matches(rule.selectorText.replace("::after", ""))).toBe(true);
    expect(document.getElementById("draft").matches(rule.selectorText.replace("::after", ""))).toBe(false);
    expect(rule.style.backgroundColor).toBe("#202124");
    expect(rule.style.getPropertyPriority("background-color")).toBe("important");
    bar.classList.remove("ahe");
    expect(bar.matches(rule.selectorText.replace("::after", ""))).toBe(true);
    bar.classList.add("ahe");
    expect(bar.outerHTML).toBe(original);
    window.eval(source);
    expect(document.getElementById("tools-darkmode-style")).toBeNull();
    expect(bar.outerHTML).toBe(original);
  });

  it("themes plain text, newsletters, tables, quotes, code, RTL and already dark mail", () => {
    const { window, document } = openGmail();
    window.eval(source);
    for (const id of ["plain", "newsletter", "thread", "collapsed"]) {
      const body = document.getElementById(id);
      expect(window.getComputedStyle(body).backgroundColor).toBe("#202124");
      expect(window.getComputedStyle(body).color).toBe("#e8eaed");
    }
    for (const selector of ["td[bgcolor]", "font", "blockquote", "code"]) {
      expect(window.getComputedStyle(document.querySelector(selector)).color).toBe("#e8eaed");
    }
    expect(window.getComputedStyle(document.querySelector("#newsletter a span")).color).toBe("#8ab4f8");
    expect(window.getComputedStyle(document.getElementById("gradient")).backgroundImage).toBe("none");
    expect(window.getComputedStyle(document.querySelector("td[bgcolor]")).backgroundColor).toBe("transparent");
    expect(window.getComputedStyle(document.getElementById("preheader")).display).toBe("none");
    expect(document.getElementById("thread").dir).toBe("rtl");
    const image = window.getComputedStyle(document.getElementById("email-image"));
    expect(image.filter).not.toContain("invert");
    expect(document.getElementById("email-image").getAttribute("width")).toBe("120");
  });

  it("darkens the surrounding conversation, preserves inbox and pop-out drafts, and restores exact markup", () => {
    const { window, document } = openGmail();
    const original = document.documentElement.outerHTML;
    const selectors = ["body", "nav", "#inbox", "#draft", ".editable"];
    const colors = () => selectors.map((selector) => {
      const style = window.getComputedStyle(document.querySelector(selector));
      return [style.color, style.backgroundColor];
    });
    const before = colors();
    for (let i = 0; i < 3; i++) {
      window.eval(source);
      expect(colors()).toEqual(before);
      expect(window.getComputedStyle(document.getElementById("message-pane")).backgroundColor).toBe("#202124");
      for (const selector of ["#message-header", "#attachments", "#reply"]) {
        expect(window.getComputedStyle(document.querySelector(selector)).color).toBe("#e8eaed");
        expect(window.getComputedStyle(document.querySelector(selector)).backgroundColor).toBe("transparent");
      }
      expect(document.querySelectorAll("#tools-darkmode-style")).toHaveLength(1);
      window.eval(source);
      expect(document.documentElement.outerHTML).toBe(original);
    }
    window.eval(source);
    document.getElementById("draft").textContent = "Updated draft";
    document.querySelector("details").open = true;
    document.querySelector(".noshow").classList.remove("noshow");
    window.eval(source);
    expect(document.getElementById("draft").textContent).toBe("Updated draft");
    expect(document.querySelector("details").open).toBe(true);
    expect(document.getElementById("collapsed").parentElement.classList.contains("noshow")).toBe(false);
  });

  it("can start in the inbox, then follow navigation, expanded threads and preview panes", () => {
    const { window, document } = openGmail("https://mail.google.com/mail/u/0/#inbox");
    document.getElementById("messages").replaceChildren();
    window.eval(source);
    const style = document.getElementById("tools-darkmode-style");
    for (const route of ["#inbox/one", "#search/receipt/two", "#all/three", "#sent/four"]) {
      window.location.hash = route;
      document.getElementById("messages").replaceChildren();
      document.getElementById("messages").insertAdjacentHTML("beforeend", '<div class="ii gt"><div class="a3s aiL" style="background-color: white; color: black">New message</div></div>');
      expect(window.getComputedStyle(document.querySelector(".ii .a3s")).backgroundColor).toBe("#202124");
      document.querySelector(".a3s").insertAdjacentHTML("beforeend", '<blockquote style="color: black">Expanded quote</blockquote>');
      expect(window.getComputedStyle(document.querySelector("blockquote")).color).toBe("#e8eaed");
      expect(document.getElementById("tools-darkmode-style")).toBe(style);
    }
    window.eval(source);
    expect(window.getComputedStyle(document.querySelector(".a3s")).backgroundColor).toBe("white");
  });
});

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

  it.each(["https://example.com/", "https://news.ycombinator.com.evil.test/", "https://ycombinator.com/", "https://mail.google.com.evil.test/", "https://google.com/"])(
    "leaves unsupported host %s unchanged", (url) => {
      const { window, document } = openSite(url);
      window.alert = vi.fn();
      const original = document.documentElement.outerHTML;
      window.eval(source);
      expect(document.documentElement.outerHTML).toBe(original);
      expect(window.alert).toHaveBeenCalledOnce();
    },
  );

  it.each(["https://news.ycombinator.com/login", "https://mail.google.com/mail/u/0/#inbox"])("loads the installation page and executes the actual encoded bookmark URL on %s", async (url) => {
    const { document, page } = await loadFrom(new URL(".", import.meta.url).pathname);
    const link = document.getElementById("bookmarklet");
    expect(link.classList.contains("disabled")).toBe(false);
    expect(document.getElementById("bookmarklet-spinner").classList.contains("d-none")).toBe(true);
    expect(link.href.startsWith("javascript:")).toBe(true);
    const { window, document: site } = url.startsWith("https://mail.google.com/") ? openGmail(url) : openSite(url);
    const code = decodeURIComponent(link.href.slice("javascript:".length));
    expect(window.eval(code)).toBeUndefined();
    expect(site.getElementById("tools-darkmode-style")).not.toBeNull();
    window.eval(code);
    expect(site.getElementById("tools-darkmode-style")).toBeNull();
    await page.close();
  });
});
