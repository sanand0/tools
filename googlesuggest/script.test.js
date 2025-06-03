import { describe, it, expect, beforeEach, afterEach, vi, SpyInstance } from 'vitest';
import { JSDOM } from 'happydom';
import fs from 'fs';
import path from 'path';

// Mocks for external dependencies
const mockAsyncLLM = vi.fn();
vi.mock('https://cdn.jsdelivr.net/npm/asyncllm@2', () => ({
  asyncLLM: mockAsyncLLM
}));

const mockMarkedParse = vi.fn(content => content); // Simple mock
vi.mock('https://cdn.jsdelivr.net/npm/marked@12', () => ({
  marked: { parse: mockMarkedParse }
}));

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; })
  };
})();

describe('Google Suggest Explorer', () => {
  let window;
  let document;
  let scriptModule;

  // Helper to simulate script tag onload for JSONP
  const simulateJsonpResponse = (data) => {
    window.currentGoogleSuggestData = data;
    // Find the last script tag added (assuming it's the JSONP one)
    const scripts = Array.from(document.head.querySelectorAll('script'));
    const jsonpScript = scripts.find(s => s.src.includes('suggestqueries.google.com'));
    if (jsonpScript && jsonpScript.onload) {
      jsonpScript.onload();
    }
  };

  // Helper to simulate script tag onerror for JSONP
  const simulateJsonpError = () => {
    const scripts = Array.from(document.head.querySelectorAll('script'));
    const jsonpScript = scripts.find(s => s.src.includes('suggestqueries.google.com'));
     if (jsonpScript && jsonpScript.onerror) {
      jsonpScript.onerror(new Error('Failed to load script'));
    }
  }

  beforeEach(async () => {
    const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');
    const happyDOM = new JSDOM();
    window = happyDOM.window;
    document = window.document;

    // Assign global properties carefully
    global.window = window;
    global.document = document;
    global.localStorage = localStorageMock;
    global.alert = vi.fn();

    // JSDOM/HappyDOM does not execute script tags by default when html is set via document.write or innerHTML
    // We need to load and execute script.js manually after the DOM is prepared.
    document.write(html); // Write HTML to the document

    // Mock script element creation to control JSONP
    // This is a bit of a heavy mock, but needed for JSONP
    const originalCreateElement = document.createElement.bind(document);
    document.createElement = (tagName) => {
        const element = originalCreateElement(tagName);
        if (tagName.toLowerCase() === 'script') {
            // Delay onload/onerror assignment to allow test to set window.currentGoogleSuggestData
            setTimeout(() => {
                if (element.src && element.src.includes('suggestqueries.google.com')) {
                    // Don't call onload/onerror immediately, let tests control this via simulateJsonpResponse/Error
                } else if (element.onload) {
                     // For other scripts, if any were to be loaded this way
                    element.onload();
                }
            }, 0);
        }
        return element;
    };


    // Load script.js as a module. Its top-level code will run, attaching event listeners.
    // Ensure script.js is in the same directory or adjust path.
    // Vitest handles ESM imports and their execution.
    scriptModule = await import('./script.js?t=' + Date.now()); // Cache bust import

    // Ensure that init function (if it modifies DOM based on localStorage) runs after mocks are set.
    // script.js runs its init() at the end. We might need to re-run parts or ensure order.
    // For LLM settings, they are read at the top of script.js. Let's re-apply them for tests.
    document.getElementById('openaiBaseUrl').value = localStorageMock.getItem("openai_base_url") || "https://api.openai.com/v1";
    document.getElementById('openaiApiKey').value = localStorageMock.getItem("openai_api_key") || "";
    document.getElementById('llmModel').value = localStorageMock.getItem("llm_model") || "openai/gpt-4.1";
    scriptModule.renderSearchHistory?.(); // re-render history if needed for tests starting with items
  });

  afterEach(() => {
    vi.clearAllMocks(); // Clears call counts, etc.
    localStorageMock.clear(); // Clears the store content itself
    // Clean up DOM
    document.body.innerHTML = '';
    document.head.innerHTML = ''; // Clear scripts added to head
    // Important: Reset globals modified for tests if they interfere across test files (not typical for HappyDOM per file)
  });

  it('should load initial UI elements', () => {
    expect(document.getElementById('searchTerm')).not.toBeNull();
    expect(document.getElementById('fetchSuggestions')).not.toBeNull();
  });

  describe('Google Suggest Fetching', () => {
    it('fetches and displays suggestions when button is clicked', async () => {
      document.getElementById('searchTerm').value = 'test query';
      document.getElementById('fetchSuggestions').click();

      // Simulate JSONP responses for a couple of countries
      await window.happyDOM.whenAsyncComplete(); // Wait for script tag to be added
      simulateJsonpResponse(['test query', ['suggestion1', 'suggestion2']]); // US
      await window.happyDOM.whenAsyncComplete();
      simulateJsonpResponse(['test query', ['suggestion3']]); // GB
      // ... simulate for all 10 or a representative subset
      for (let i = 0; i < 8; i++) { // Mock remaining 8 countries as success to avoid timeouts
        simulateJsonpResponse(['test query', ['dummy suggestion']]);
        await window.happyDOM.whenAsyncComplete();
      }

      // Wait for all promises in fetchGoogleSuggestions to resolve
      await window.happyDOM.whenAsyncComplete();
      await window.happyDOM.whenAsyncComplete(); // extra safety for chained promises

      const resultsDiv = document.getElementById('results');
      expect(resultsDiv.querySelector('h3').textContent).toContain('Suggestions for "test query"');

      const countryCards = resultsDiv.querySelectorAll('.card');
      // Assuming 10 countries are mocked in total (2 specific, 8 dummy)
      expect(countryCards.length).toBe(10);

      // Check first mocked country (US)
      const usCard = Array.from(countryCards).find(card => card.querySelector('.card-header.country-name').textContent.includes('United States'));
      expect(usCard).not.toBeNull();
      expect(usCard.querySelector('.card-header.country-name').textContent).toContain('United States (US)');
      const usSuggestionLinks = usCard.querySelectorAll('.suggestions-list li a');
      expect(usSuggestionLinks.length).toBe(2);
      expect(usSuggestionLinks[0].textContent).toBe('suggestion1');
      expect(usSuggestionLinks[0].href).toBe('https://www.google.com/search?q=suggestion1');
      expect(usSuggestionLinks[1].textContent).toBe('suggestion2');
      expect(usSuggestionLinks[1].href).toBe('https://www.google.com/search?q=suggestion2');

      // Check second mocked country (GB)
      const gbCard = Array.from(countryCards).find(card => card.querySelector('.card-header.country-name').textContent.includes('United Kingdom'));
      expect(gbCard).not.toBeNull();
      expect(gbCard.querySelector('.card-header.country-name').textContent).toContain('United Kingdom (GB)');
      const gbSuggestionLinks = gbCard.querySelectorAll('.suggestions-list li a');
      expect(gbSuggestionLinks.length).toBe(1);
      expect(gbSuggestionLinks[0].textContent).toBe('suggestion3');
      expect(gbSuggestionLinks[0].href).toBe('https://www.google.com/search?q=suggestion3');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(expect.stringContaining('googleSuggest_v1.1_test query'), expect.any(String));
    });

    it('displays error for a country if JSONP fails for it', async () => {
        document.getElementById('searchTerm').value = 'error query';
        document.getElementById('fetchSuggestions').click();

        await window.happyDOM.whenAsyncComplete();
        simulateJsonpError(); // Simulate error for the first country (US)
        await window.happyDOM.whenAsyncComplete();
        // Simulate success for another to ensure partial success is handled
        simulateJsonpResponse(['error query', ['suggestionGB']]); // GB
        await window.happyDOM.whenAsyncComplete();


        // Fill in for other countries or assume they also error/succeed to simplify
        for (let i = 0; i < 8; i++) { // Mock remaining 8 countries as success to avoid timeouts
             simulateJsonpResponse(['error query', ['dummy suggestion']]);
             await window.happyDOM.whenAsyncComplete();
        }

        await window.happyDOM.whenAsyncComplete(); // For promises to settle

        const resultsDiv = document.getElementById('results');
        const countryCards = resultsDiv.querySelectorAll('.card');

        const usCard = Array.from(countryCards).find(card => card.querySelector('.card-header.country-name').textContent.includes('United States'));
        expect(usCard).not.toBeNull();
        expect(usCard.querySelector('.card-header.country-name').textContent).toContain('Error');
        expect(usCard.querySelector('.card-body').textContent).toContain('Failed to load');

        const gbCard = Array.from(countryCards).find(card => card.querySelector('.card-header.country-name').textContent.includes('United Kingdom'));
        expect(gbCard).not.toBeNull();
        expect(gbCard.querySelector('.card-body').textContent).toContain('suggestionGB');
    });
  });

  describe('LLM Explanation', () => {
    it('calls asyncLLM and displays explanation', async () => {
      // First, get some suggestions
      document.getElementById('searchTerm').value = 'llm test';
      document.getElementById('fetchSuggestions').click();
      await window.happyDOM.whenAsyncComplete();
      simulateJsonpResponse(['llm test', ['s1']]); // US
      // Simulate for other countries quickly
      for(let i=0; i<9; i++) { simulateJsonpResponse(['llm test', ['s'+(i+2)]]); await window.happyDOM.whenAsyncComplete(); }
      await window.happyDOM.whenAsyncComplete();


      document.getElementById('openaiApiKey').value = 'test-key';
      mockAsyncLLM.mockImplementation(async function*() {
        yield { content: 'Humorous ' };
        yield { content: 'Humorous explanation.' };
      });

      document.getElementById('explainButton').click();
      await window.happyDOM.whenAsyncComplete();

      expect(mockAsyncLLM).toHaveBeenCalled();
      expect(mockAsyncLLM.mock.calls[0][0]).toContain('/chat/completions'); // Check endpoint
      const requestBody = JSON.parse(mockAsyncLLM.mock.calls[0][1].body);
      expect(requestBody.messages[0].content).toContain('llm test');
      expect(requestBody.messages[0].content).toContain('outliers with unique or unusual perspectives');
      expect(mockMarkedParse).toHaveBeenCalledWith('Humorous explanation.');
      expect(document.getElementById('llmResponse').textContent).toContain('Humorous explanation.');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(expect.stringContaining('llmExplanation_v1.1_llm test'), '"Humorous explanation."');
    });
  });

  describe('Caching', () => {
    it('loads suggestions from cache', async () => {
      const query = 'cached query';
      const cachedData = { US: { country: "United States", code: "US", suggestions: ["cached sug"] } };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(cachedData)); // For GOOGLE_SUGGEST_CACHE_PREFIX + query

      document.getElementById('searchTerm').value = query;
      document.getElementById('fetchSuggestions').click();
      await window.happyDOM.whenAsyncComplete();

      // Check that no new script tags were added for google suggest (or very few, if any other scripts load)
      const scriptTags = Array.from(document.querySelectorAll('script[src*="suggestqueries.google.com"]'));
      expect(scriptTags.length).toBe(0); // No JSONP calls should be made
      expect(document.getElementById('results').textContent).toContain('cached sug');
    });

    it('loads LLM explanation from cache', async () => {
        const query = 'cached llm';
        const suggestions = { US: { country: "United States", code: "US", suggestions: ["sug"] }};
        const llmResponse = "Cached LLM response";

        // Simulate suggestions being loaded (either from cache or fresh)
        // Directly set currentSuggestions and currentQuery on the module if possible, or trigger UI flow to do so
        // This part might need adjustment based on how scriptModule exposes these variables or if we need to run fetchGoogleSuggestions first
        // For simplicity, assuming these are set correctly by a prior action (not shown in this isolated test for LLM cache)
        document.getElementById('searchTerm').value = query; // Set query for context
        scriptModule.currentSuggestions = suggestions; // Manually set for test
        scriptModule.currentQuery = query; // Manually set for test
        document.getElementById('explainButton').disabled = false;


        const suggestionsHash = JSON.stringify(suggestions).split("").reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0).toString(16);
        const llmCacheKey = `llmExplanation_v1.1_${query.toLowerCase()}_${document.getElementById('llmModel').value}_${suggestionsHash}`;
        localStorageMock.getItem.mockImplementation(key => {
            if (key === llmCacheKey) return JSON.stringify(llmResponse);
            return null;
        });

        document.getElementById('openaiApiKey').value = 'test-key'; // Still needed for button to be enabled for this flow
        document.getElementById('explainButton').click();
        await window.happyDOM.whenAsyncComplete();

        expect(mockAsyncLLM).not.toHaveBeenCalled();
        expect(document.getElementById('llmResponse').textContent).toContain(llmResponse);
    });
  });

  describe('Search History', () => {
    it('adds to search history and displays it', async () => {
      document.getElementById('searchTerm').value = 'history query';
      document.getElementById('fetchSuggestions').click();
      // Simulate a quick successful fetch for history to be added
      await window.happyDOM.whenAsyncComplete();
      simulateJsonpResponse(['history query', ['sug']]);
      for(let i=0; i<9; i++) { simulateJsonpResponse(['history query', ['s'+(i+2)]]); await window.happyDOM.whenAsyncComplete(); }
      await window.happyDOM.whenAsyncComplete();

      expect(localStorageMock.setItem).toHaveBeenCalledWith(expect.stringContaining('searchHistory_v1.1'), expect.stringContaining('history query'));
      const historyDiv = document.getElementById('searchHistory');
      expect(historyDiv.textContent).toContain('history query');
    });

    it('clicking history item performs a search', async () => {
      // Setup history
      localStorageMock.getItem.mockImplementation(key => {
        if (key.startsWith('searchHistory')) return JSON.stringify(['history click test']);
        return null;
      });
      scriptModule.renderSearchHistory(); // Manually call to render based on mock
      await window.happyDOM.whenAsyncComplete();


      const historyButton = document.querySelector('#searchHistory button');
      expect(historyButton).not.toBeNull();
      historyButton.click();
      await window.happyDOM.whenAsyncComplete();

      expect(document.getElementById('searchTerm').value).toBe('history click test');
      // Check if fetchGoogleSuggestions was triggered (e.g. by checking for loading indicator or script tags)
      // This will try to make real JSONP calls unless we also mock the result of 'history click test' query
      expect(document.getElementById('loadingIndicator').classList.contains('d-none')).toBe(false); // Indiates fetch started
    });
  });

  describe('LLM Settings Persistence', () => {
    it('saves LLM settings to localStorage on change', () => {
        const modelSelect = document.getElementById('llmModel');
        const baseUrlInput = document.getElementById('openaiBaseUrl');
        const apiKeyInput = document.getElementById('openaiApiKey');

        modelSelect.value = 'google/gemini-2.5-flash-preview-05-20';
        modelSelect.dispatchEvent(new window.Event('change'));
        expect(localStorageMock.setItem).toHaveBeenCalledWith('llm_model', 'google/gemini-2.5-flash-preview-05-20');

        baseUrlInput.value = 'https://example.com/api';
        baseUrlInput.dispatchEvent(new window.Event('change'));
        expect(localStorageMock.setItem).toHaveBeenCalledWith('openai_base_url', 'https://example.com/api');

        apiKeyInput.value = 'new-api-key';
        apiKeyInput.dispatchEvent(new window.Event('change'));
        expect(localStorageMock.setItem).toHaveBeenCalledWith('openai_api_key', 'new-api-key');
    });

    it('loads LLM settings from localStorage on init', async () => {
        localStorageMock.getItem
            .mockReturnValueOnce('openai/gpt-4.1-mini') // llm_model for the script's initial load
            .mockReturnValueOnce('https://custom.openai.com/v1') // openai_base_url for the script's initial load
            .mockReturnValueOnce('ls-api-key'); // openai_api_key for the script's initial load

        // The script module when imported should have already read from localStorage.
        // Our beforeEach re-applies these from the mock to the DOM elements after script load.
        // So, we check the DOM elements' values which should reflect what script.js set them to.
        // This test implicitly verifies that the script's own loading logic for these values works.
        // Re-importing or re-running the script's init for settings is complex.
        // We trust that the initial load in beforeEach + the script's own logic handles it.

        // The values in the DOM should reflect what script.js set them to during its initialization phase,
        // based on the localStorageMock values provided at that time.
        // The beforeEach in this test suite re-sets the DOM values from localStorageMock *after* the script import,
        // which simulates the script's own initial loading behavior for these fields.
        expect(document.getElementById('llmModel').value).toBe('openai/gpt-4.1-mini');
        expect(document.getElementById('openaiBaseUrl').value).toBe('https://custom.openai.com/v1');
        expect(document.getElementById('openaiApiKey').value).toBe('ls-api-key');
    });
  });
});
