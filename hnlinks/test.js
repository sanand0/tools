import { describe, it, expect, beforeEach } from 'vitest';
import { Window } from 'happy-dom';
import fs from 'fs';
import path from 'path';

// Determine the correct path to hnlinks.test.html
const htmlFilePath = path.resolve(process.cwd(), 'hnlinks.test.html');
const html = fs.readFileSync(htmlFilePath, 'utf8');

describe('HN Links Extractor Tests', () => {
  let currentWindow;
  let currentDocument;

  beforeEach(async () => {
    currentWindow = new Window();
    currentDocument = currentWindow.document;
    currentDocument.write(html);

    global.window = currentWindow;
    global.document = currentDocument;

    // Mock localStorage (if needed by script.js, good practice to have)
    if (!currentWindow.localStorage) {
      currentWindow.localStorage = (() => {
        let store = {};
        return {
          getItem: (key) => store[key] || null,
          setItem: (key, value) => { store[key] = value.toString(); },
          removeItem: (key) => { delete store[key]; },
          clear: () => { store = {}; },
          key: (index) => Object.keys(store)[index] || null,
          get length() { return Object.keys(store).length; }
        };
      })();
    }
    global.localStorage = currentWindow.localStorage;

    // Attempt to import script.js
    // This is included as per typical test structure.
    // If script.js doesn't exist, this will be caught.
    try {
      await import('./script.js');
    } catch (e) {
      // console.error("Test Setup: Error importing hnlinks/script.js (it might not exist yet):", e.message);
    }

    // Dispatch DOMContentLoaded to trigger any setup logic in script.js
    currentDocument.dispatchEvent(new currentWindow.Event('DOMContentLoaded', { bubbles: true, cancelable: true }));
    await currentWindow.happyDOM.whenAsyncComplete();
  });

  it('should have the "Scrape Links" button present', () => {
    const scrapeButton = currentDocument.getElementById('scrapeButton');
    expect(scrapeButton).not.toBeNull();
    expect(scrapeButton.textContent).toContain('Scrape Links');
    expect(scrapeButton.tagName).toBe('BUTTON');
  });

  // Placeholder for more tests once script.js is implemented
  // it('should fetch and display links when "Scrape Links" is clicked', async () => {
  //   // This test would involve mocking fetch/XHR if script.js uses them,
  //   // simulating a click, and checking the linksTextArea.
  //   const scrapeButton = currentDocument.getElementById('scrapeButton');
  //   scrapeButton.click();
  //   await currentWindow.happyDOM.whenAsyncComplete(); // wait for async operations
  //   const linksTextArea = currentDocument.getElementById('linksTextArea');
  //   // expect(linksTextArea.value).toContain('http'); // Or some mock link
  // });
});
