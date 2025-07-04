import { showToast } from "../common/toast.js";
import saveform from "https://cdn.jsdelivr.net/npm/saveform@1.2";

document.addEventListener("DOMContentLoaded", () => {
  const sourceUrlSelect = document.getElementById("sourceUrl");
  const scrapeButton = document.getElementById("scrapeButton");
  const linksTextArea = document.getElementById("linksTextArea");
  const copyButton = document.getElementById("copyButton");
  const loadingIndicator = document.getElementById("loadingIndicator");
  saveform("#hnlinks-form");

  const PROXY_BASE = "https://llmfoundry.straive.com/-/proxy/";

  async function fetchAndParse(url) {
    const proxyUrl = PROXY_BASE + url;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    const htmlText = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(htmlText, "text/html");
  }

  function getAbsoluteUrl(baseUrl, relativeUrl) {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch {
      // Handle cases where relativeUrl might be malformed or already absolute in a weird way
      if (relativeUrl.startsWith("http://") || relativeUrl.startsWith("https://")) return relativeUrl;
      console.warn(`Could not form absolute URL for base: ${baseUrl}, relative: ${relativeUrl}`);
      return relativeUrl; // fallback
    }
  }

  scrapeButton.addEventListener("click", async () => {
    const selectedUrl = sourceUrlSelect.value;
    linksTextArea.value = ""; // Clear previous results
    loadingIndicator.classList.remove("d-none");
    scrapeButton.disabled = true;

    try {
      const doc = await fetchAndParse(selectedUrl);
      let extractedLinks = [];
      let linkText = {};
      const siteOrigin = new URL(selectedUrl).origin;

      if (selectedUrl.includes("news.ycombinator.com")) {
        const links = doc.querySelectorAll("span.titleline > a");
        links.forEach((link) => {
          const title = link.textContent.trim();
          const href = link.getAttribute("href");
          linkText[href] = title;
          if (href && !title.startsWith("Ask HN:") && !title.startsWith("Show HN:") && !href.startsWith("from?site=")) {
            // Check if it's an internal HN link like item?id=
            // These are kept as they are discussion links for self-posts
            if (href.startsWith("item?id=")) {
              extractedLinks.push(getAbsoluteUrl("https://news.ycombinator.com/", href));
            } else if (href.startsWith("http://") || href.startsWith("https://")) {
              extractedLinks.push(href);
            } else {
              // Relative path, likely an internal page not caught, but attempt to make absolute
              extractedLinks.push(getAbsoluteUrl(siteOrigin, href));
            }
          }
        });
      } else if (selectedUrl.includes("hntoplinks.com")) {
        // This selector is more generic and relies on filtering.
        // It assumes articles are in some main content area.
        // A more specific selector would be better if the structure was known.
        // For now, we find all links within what seems to be the main content area.
        // Looking at the text output, stories are listed one by one.
        // Let's try to target links that are likely titles.
        // The text output showed links like `[9]My AI skeptic friends are all nuts (fly.io)`
        // These are `<a>` tags. We need to avoid comment links and user links.
        const allLinks = doc.querySelectorAll("a[href]"); // Broad selector, needs careful filtering

        allLinks.forEach((link) => {
          const href = link.getAttribute("href");
          const text = link.textContent.trim();
          linkText[href] = text;

          if (!href || href === "#" || href.startsWith("javascript:")) return;

          // Filter out navigation, user profiles, comments, etc.
          if (href.includes("news.ycombinator.com/user?id=")) return;
          if (href.includes("news.ycombinator.com/item?id=")) return; // These are comment links on hntoplinks
          if (href.startsWith("/subscribers") || href.startsWith("/stories/") || href.startsWith("/about")) return;
          if (href.startsWith("/today?page=") || href.startsWith("/week?page=") || href.startsWith("/month?page="))
            return;
          if (
            text.match(/^\d{4}$/) ||
            ["Today", "This Week", "This Month", "This Year", "All", "Subscribe", "Next »", "About"].includes(text)
          )
            return;
          if (text.startsWith("Ask HN:") || text.startsWith("Show HN:")) return;

          // Ensure the link is not part of the site's own chrome/navigation
          // This is tricky without seeing the full structure.
          // We assume main article links don't have obvious nav classes or IDs.
          // A simple check: if the parent is a nav element, skip.
          let parent = link.parentElement;
          let isNav = false;
          for (let i = 0; i < 3; ++i) {
            // Check up to 3 levels for nav, header, footer
            if (!parent) break;
            if (
              parent.tagName === "NAV" ||
              parent.tagName === "HEADER" ||
              parent.tagName === "FOOTER" ||
              parent.id === "nav" ||
              parent.classList.contains("nav")
            ) {
              isNav = true;
              break;
            }
            parent = parent.parentElement;
          }
          if (isNav) return;

          // If it's a relative link, make it absolute from hntoplinks.com
          extractedLinks.push(getAbsoluteUrl(siteOrigin, href));
        });
      }

      // Remove duplicates and display
      const uniqueLinks = [...new Set(extractedLinks)];
      linksTextArea.value = uniqueLinks.map((link) => `[${linkText[link]}](${link})`).join("\n");
      if (uniqueLinks.length === 0) {
        linksTextArea.value = "No article links found matching the criteria.";
      }
    } catch (error) {
      console.error("Error scraping links:", error);
      linksTextArea.value = `Error: ${error.message}`;
      showToast({ title: "Scraping error", body: error.message, color: "bg-danger" });
    } finally {
      loadingIndicator.classList.add("d-none");
      scrapeButton.disabled = false;
    }
  });

  copyButton.addEventListener("click", () => {
    if (linksTextArea.value) {
      navigator.clipboard
        .writeText(linksTextArea.value)
        .then(() => {
          const originalText = copyButton.innerHTML;
          copyButton.innerHTML = '<i class="bi bi-check-lg me-1"></i> Copied!';
          copyButton.classList.remove("btn-secondary");
          copyButton.classList.add("btn-success");
          setTimeout(() => {
            copyButton.innerHTML = originalText;
            copyButton.classList.remove("btn-success");
            copyButton.classList.add("btn-secondary");
          }, 2000);
        })
        .catch((err) => {
          console.error("Failed to copy links:", err);
          showToast({
            title: "Copy error",
            body: "Failed to copy links to clipboard. See console for details.",
            color: "bg-danger",
          });
        });
    }
  });
});
