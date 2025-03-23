// YouTube Focus Extension - Popup Script

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const extensionToggle = document.getElementById('extension-toggle');
    const maxResultsInput = document.getElementById('max-results');
    const hideCommentsInput = document.getElementById('hide-comments');
    const hideRecommendationsInput = document.getElementById('hide-recommendations');
    const redirectSearchInput = document.getElementById('redirect-search');
    const openSearchButton = document.getElementById('open-search');
    const saveSettingsButton = document.getElementById('save-settings');
    
    // Load current settings
    chrome.storage.sync.get(null, (settings) => {
      extensionToggle.checked = settings.enabled !== false;
      maxResultsInput.value = settings.maxResults || 20;
      hideCommentsInput.checked = settings.hideComments !== false;
      hideRecommendationsInput.checked = settings.hideRecommendations !== false;
      redirectSearchInput.checked = settings.redirectSearch !== false;
      
      // Update UI state based on extension toggle
      updateUIState(extensionToggle.checked);
    });
    
    // Extension toggle event
    extensionToggle.addEventListener('change', () => {
      // Update settings
      chrome.storage.sync.set({ enabled: extensionToggle.checked });
      
      // Update UI state
      updateUIState(extensionToggle.checked);
      
      // Update extension icon
      const iconPath = extensionToggle.checked ? 'icons/icon48.png' : 'icons/icon48-disabled.png';
      chrome.action.setIcon({ path: iconPath });
      
      // Refresh current tab if it's YouTube
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].url.includes('youtube.com')) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
    
    // Save settings button event
    saveSettingsButton.addEventListener('click', () => {
      // Validate max results
      let maxResults = parseInt(maxResultsInput.value);
      if (isNaN(maxResults) || maxResults < 5) {
        maxResults = 5;
        maxResultsInput.value = 5;
      } else if (maxResults > 50) {
        maxResults = 50;
        maxResultsInput.value = 50;
      }
      
      // Save settings
      chrome.storage.sync.set({
        maxResults: maxResults,
        hideComments: hideCommentsInput.checked,
        hideRecommendations: hideRecommendationsInput.checked,
        redirectSearch: redirectSearchInput.checked
      }, () => {
        // Show feedback
        saveSettingsButton.textContent = 'Saved!';
        setTimeout(() => {
          saveSettingsButton.textContent = 'Save Settings';
        }, 1000);
        
        // Refresh current tab if it's YouTube
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0].url.includes('youtube.com')) {
            chrome.tabs.reload(tabs[0].id);
          }
        });
      });
    });
    
    // Open search button event
    openSearchButton.addEventListener('click', () => {
      const searchPage = chrome.runtime.getURL('pages/search.html');
      
      // Open in new tab if extension is enabled
      if (extensionToggle.checked) {
        chrome.tabs.create({ url: searchPage });
      } else {
        // Enable extension first, then open
        chrome.storage.sync.set({ enabled: true }, () => {
          extensionToggle.checked = true;
          updateUIState(true);
          chrome.tabs.create({ url: searchPage });
        });
      }
    });
    
    /**
     * Update UI state based on extension toggle
     * @param {boolean} enabled - Extension enabled state
     */
    function updateUIState(enabled) {
      // Enable/disable settings inputs
      const inputs = [
        maxResultsInput,
        hideCommentsInput,
        hideRecommendationsInput,
        redirectSearchInput
      ];
      
      inputs.forEach(input => {
        input.disabled = !enabled;
      });
      
      // Update save button state
      saveSettingsButton.disabled = !enabled;
      
      // Update UI appearance based on state
      document.body.style.opacity = enabled ? 1 : 0.7;
    }
  });