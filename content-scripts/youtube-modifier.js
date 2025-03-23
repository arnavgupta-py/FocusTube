// FocusTube - Content Script for YouTube Modification

// Settings object to store extension configurations
let settings = {
  enabled: true,
  hideComments: true,
  hideRecommendations: true,
  maxResults: 20,
  agentEnabled: true,
  interfaceConfig: null
};

// Get settings from background script
chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
  if (response) {
    settings = {
      ...response,
      agentEnabled: response.agentPreferences?.agentEnabled !== false
    };
    
    // Apply modifications if extension is enabled
    if (settings.enabled) {
      cleanYouTubePage();
      
      // Set up observer to handle dynamic content loading
      setupMutationObserver();
    }
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'cleanPage' && settings.enabled) {
    cleanYouTubePage();
    sendResponse({ success: true });
    return true;
  }
  
  if (request.action === 'updateAgentInterface') {
    // Store interface config if provided
    if (request.data.interfaceConfig) {
      settings.interfaceConfig = request.data.interfaceConfig;
      
      // Apply interface configuration
      applyInterfaceConfig(request.data.interfaceConfig);
    }
    
    // Forward to agent interface
    window.postMessage({
      type: 'FOCUSTUBE_UPDATE_INTERFACE',
      data: request.data
    }, '*');
    
    sendResponse({ success: true });
    return true;
  }
});

/**
 * Main function to clean up YouTube interface
 */
function cleanYouTubePage() {
  const currentUrl = window.location.href;
  
  // Handle different YouTube page types
  if (currentUrl.includes('youtube.com/watch')) {
    cleanWatchPage();
  } else if (currentUrl.includes('youtube.com/results')) {
    cleanSearchResults();
  } else if (currentUrl.includes('youtube.com')) {
    cleanHomePage();
  }
}

/**
 * Clean up YouTube watch page
 */
function cleanWatchPage() {
  // Hide comments section if enabled in settings
  if (settings.hideComments) {
    hideComments();
  }
  
  // Hide recommended videos if enabled in settings
  if (settings.hideRecommendations) {
    hideRelatedVideos();
  }
  
  // Remove other distracting elements
  hideElement('merch-shelf');
  hideElement('playlist');
  
  // Hide header elements like Create button
  hideHeaderElements();
  
  // Apply minimalist styling
  applyCleanStyle();
  
  // Apply additional configuration based on agent settings
  if (settings.agentEnabled && settings.interfaceConfig) {
    applyInterfaceConfig(settings.interfaceConfig);
  }
  
  // Set up delayed cleanup to catch dynamically loaded elements
  setupDelayedCleanup();
}

/**
 * Clean up YouTube search results page
 */
function cleanSearchResults() {
  // Limit number of search results
  limitSearchResults();
  
  // Remove ads and promotions
  removeAds();
  
  // Hide header elements like Create button
  hideHeaderElements();
  
  // Apply minimalist styling
  applyCleanStyle();
}

/**
 * Clean up YouTube home page
 */
function cleanHomePage() {
  // Hide all recommended content
  const contentSections = document.querySelectorAll('ytd-rich-grid-renderer');
  contentSections.forEach(section => {
    section.style.display = 'none';
  });
  
  // Hide header elements like Create button
  hideHeaderElements();
  
  // Create a clean interface with search only
  createCleanHomePage();
}

/**
 * Specifically hide comments with multiple strategies
 */
function hideComments() {
  // Use multiple selectors to target comments section
  const commentSelectors = [
    '#comments',
    'ytd-comments',
    '#comment-section',
    'ytd-item-section-renderer.ytd-comments',
    '#sections > ytd-item-section-renderer:nth-child(2)',
    'ytd-comments-header-renderer',
    '#sections'
  ];
  
  commentSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (el.id === 'sections') {
        // For the sections container, only hide it if it contains comments
        const children = el.querySelectorAll('ytd-comments');
        if (children.length > 0) {
          el.style.display = 'none';
        }
      } else {
        el.style.display = 'none';
      }
    });
  });
  
  // Add a style element for more aggressive hiding
  if (!document.getElementById('focustube-hide-comments-style')) {
    const style = document.createElement('style');
    style.id = 'focustube-hide-comments-style';
    style.textContent = `
      #comments, 
      ytd-comments, 
      #comment-section, 
      ytd-item-section-renderer.ytd-comments,
      ytd-comments-header-renderer,
      #sections > ytd-item-section-renderer:has(ytd-comments) {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Specifically hide related videos with multiple strategies
 */
function hideRelatedVideos() {
  // Use multiple selectors to target related videos section
  const relatedSelectors = [
    '#related',
    'ytd-watch-next-secondary-results-renderer',
    '#secondary',
    '#secondary-inner'
  ];
  
  relatedSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.display = 'none';
    });
  });
  
  // Add a style element for more aggressive hiding
  if (!document.getElementById('focustube-hide-related-style')) {
    const style = document.createElement('style');
    style.id = 'focustube-hide-related-style';
    style.textContent = `
      #related, 
      ytd-watch-next-secondary-results-renderer, 
      #secondary,
      #secondary-inner {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Hide header elements like Create button
 */
function hideHeaderElements() {
  if (!document.getElementById('focustube-header-styles')) {
    const style = document.createElement('style');
    style.id = 'focustube-header-styles';
    style.textContent = `
      /* Hide header buttons like Create, Notifications, etc. */
      ytd-masthead #end #buttons ytd-button-renderer,
      ytd-masthead #end #buttons .ytd-masthead,
      ytd-masthead #end .ytd-masthead,
      ytd-masthead #end #buttons .yt-spec-button-shape-next,
      ytd-masthead #buttons ytd-notification-topbar-button-renderer,
      ytd-masthead #buttons ytd-create-button-renderer,
      ytd-masthead #buttons .ytd-masthead[aria-label="Create"],
      yt-icon-button.ytd-notification-topbar-button-renderer,
      yt-icon-button[aria-label="Create"] {
        display: none !important;
      }
      
      /* Keep search and avatar for usability */
      ytd-masthead #search,
      ytd-masthead #avatar-btn {
        display: flex !important;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Helper function to hide specific elements
 */
function hideElement(elementId) {
  // Try different selector patterns used by YouTube
  const selectors = [
    `#${elementId}`,
    `ytd-${elementId}`,
    `[data-content-type="${elementId}"]`,
    `.ytd-${elementId}-renderer`
  ];
  
  selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      el.style.display = 'none';
    });
  });
}

/**
 * Set up delayed cleanup to handle dynamic content
 */
function setupDelayedCleanup() {
  // Run again after a slight delay to catch dynamically loaded elements
  setTimeout(() => {
    if (settings.hideComments) {
      hideComments();
    }
    if (settings.hideRecommendations) {
      hideRelatedVideos();
    }
    // Re-apply header hiding
    hideHeaderElements();
  }, 2000); // 2 second delay
  
  // Run again after a longer delay for slow-loading pages
  setTimeout(() => {
    if (settings.hideComments) {
      hideComments();
    }
    if (settings.hideRecommendations) {
      hideRelatedVideos();
    }
  }, 5000); // 5 second delay
}

/**
 * Limit the number of search results shown
 */
function limitSearchResults() {
  const resultItems = document.querySelectorAll('ytd-video-renderer, ytd-grid-video-renderer');
  
  if (resultItems.length > settings.maxResults) {
    for (let i = settings.maxResults; i < resultItems.length; i++) {
      resultItems[i].style.display = 'none';
    }
  }
}

/**
 * Remove ads from search results and watch pages
 */
function removeAds() {
  const adSelectors = [
    'ytd-promoted-video-renderer',
    'ytd-display-ad-renderer',
    'ytd-compact-promoted-video-renderer',
    '.ytd-promoted-sparkles-web-renderer',
    '[id^="ad"]',
    'ytd-in-feed-ad-layout-renderer',
    '.ytd-player-legacy-desktop-watch-ads-renderer',
    '#masthead-ad'
  ];
  
  adSelectors.forEach(selector => {
    const ads = document.querySelectorAll(selector);
    ads.forEach(ad => {
      ad.remove();
    });
  });
  
  // Add style to hide ads that might load later
  if (!document.getElementById('focustube-hide-ads-style')) {
    const style = document.createElement('style');
    style.id = 'focustube-hide-ads-style';
    style.textContent = `
      ytd-promoted-video-renderer,
      ytd-display-ad-renderer,
      ytd-compact-promoted-video-renderer,
      .ytd-promoted-sparkles-web-renderer,
      [id^="ad"],
      ytd-in-feed-ad-layout-renderer,
      .ytd-player-legacy-desktop-watch-ads-renderer,
      #masthead-ad {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Apply clean styling to YouTube pages
 */
function applyCleanStyle() {
  // Check if styles already applied
  if (document.getElementById('focustube-clean-styles')) {
    return;
  }
  
  // Create and insert custom CSS
  const styleElement = document.createElement('style');
  styleElement.id = 'focustube-clean-styles';
  styleElement.textContent = `
    /* Clean styling for YouTube */
    ytd-watch-flexy {
      --ytd-watch-flexy-width: 60% !important;
    }
    
    #primary {
      margin: 0 auto !important;
      max-width: 1000px !important;
    }
    
    #secondary { 
      display: none !important; 
    }
    
    ytd-watch-metadata {
      padding: 20px !important;
      background: #f0f7ff !important;
      border-radius: 8px !important;
      margin: 20px 0 !important;
      border: 1px solid #d0e0ff !important;
    }
    
    /* Make video info section more visible with a different background color */
    #above-the-fold,
    #meta,
    #info-contents {
      background-color: #f0f7ff !important; /* Light blue background */
      border-radius: 8px !important;
      padding: 16px !important;
      margin-top: 16px !important;
      border: 1px solid #d0e0ff !important; /* Light blue border */
    }
    
    /* Make hashtags more visible */
    .super-title,
    .super-title a,
    yt-formatted-string.super-title {
      color: #1a73e8 !important; /* Brighter blue for hashtags */
      font-weight: 500 !important;
    }
    
    /* Hide distracting elements */
    #chips-wrapper,
    #masthead-ad,
    .ytp-ce-element,
    .ytp-cards-teaser,
    ytd-mini-guide-renderer,
    ytd-guide-renderer,
    .ytp-pause-overlay,
    .ytp-endscreen-content {
      display: none !important;
    }
    
    /* Make video player cleaner */
    .html5-video-player {
      background-color: black !important;
    }
    
    /* FocusTube UI elements */
    .focustube-panel {
      font-family: Roboto, Arial, sans-serif !important;
    }
    
    /* Agent notification */
    .focustube-notification {
      background-color: rgba(255, 255, 255, 0.9);
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      z-index: 9000;
      font-family: Roboto, Arial, sans-serif;
    }
  `;
  
  document.head.appendChild(styleElement);
}

/**
 * Apply interface configuration based on agent settings
 * @param {Object} config - Interface configuration
 */
function applyInterfaceConfig(config) {
  // Apply different configurations based on settings
  if (config.hideComments) {
    hideComments();
  } else {
    // Remove style if it exists
    const style = document.getElementById('focustube-hide-comments-style');
    if (style) {
      style.remove();
    }
  }
  
  if (!config.showRelatedVideos) {
    hideRelatedVideos();
  } else {
    // Remove style if it exists
    const style = document.getElementById('focustube-hide-related-style');
    if (style) {
      style.remove();
    }
  }
  
  if (config.showTranscript) {
    // Wait a bit for YouTube UI to load
    setTimeout(showTranscript, 2000);
  }
  
  if (config.noteMode) {
    // Add note-taking UI if it doesn't exist
    if (!document.getElementById('focustube-notes-panel')) {
      addNotePanel();
    }
  }
  
  if (config.playbackRate && config.playbackRate !== 1.0) {
    // Set playback rate
    setTimeout(() => {
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.playbackRate = config.playbackRate;
      }
    }, 1000);
  }
}

/**
 * Show transcript panel
 */
function showTranscript() {
  // Look for the three dots menu
  const moreButton = document.querySelector('.ytp-mute-button')?.nextElementSibling?.nextElementSibling?.nextElementSibling;
  
  if (moreButton) {
    // Click to open menu
    moreButton.click();
    
    // Look for the transcript option
    setTimeout(() => {
      const menuItems = document.querySelectorAll('tp-yt-paper-item');
      for (const item of menuItems) {
        if (item.textContent.includes('Show transcript')) {
          item.click();
          break;
        }
      }
      
      // Click elsewhere to close menu if transcript not found
      document.body.click();
    }, 500);
  }
}

/**
 * Add note-taking panel
 */
function addNotePanel() {
  // Create a note-taking panel
  const notesPanel = document.createElement('div');
  notesPanel.id = 'focustube-notes-panel';
  notesPanel.style.cssText = `
    position: fixed;
    top: 70px;
    right: 20px;
    width: 300px;
    height: 400px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    z-index: 2000;
    display: flex;
    flex-direction: column;
    font-family: Roboto, Arial, sans-serif;
    overflow: hidden;
  `;
  
  notesPanel.innerHTML = `
    <div style="padding: 12px 16px; background-color: #f1f1f1; display: flex; justify-content: space-between; align-items: center;">
      <h3 style="margin: 0; font-size: 16px;">Video Notes</h3>
      <button id="focustube-close-notes" style="background: none; border: none; cursor: pointer; font-size: 18px;">×</button>
    </div>
    <textarea id="focustube-notes-content" style="flex-grow: 1; border: none; resize: none; padding: 12px; font-size: 14px;" 
      placeholder="Take notes while watching..."></textarea>
    <div style="padding: 8px 16px; border-top: 1px solid #f1f1f1; display: flex; justify-content: space-between;">
      <button id="focustube-save-notes" style="background-color: #4285f4; color: white; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer;">
        Save Notes
      </button>
      <button id="focustube-clear-notes" style="background-color: #f1f1f1; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer;">
        Clear
      </button>
    </div>
  `;
  
  document.body.appendChild(notesPanel);
  
  // Load existing notes for this video
  loadNotes();
  
  // Set up event listeners
  document.getElementById('focustube-close-notes').addEventListener('click', () => {
    notesPanel.style.display = 'none';
  });
  
  document.getElementById('focustube-save-notes').addEventListener('click', () => {
    saveNotes();
  });
  
  document.getElementById('focustube-clear-notes').addEventListener('click', () => {
    document.getElementById('focustube-notes-content').value = '';
    saveNotes();
  });
}

/**
 * Load notes for current video
 */
function loadNotes() {
  const videoId = getCurrentVideoId();
  if (!videoId) return;
  
  chrome.storage.local.get('videoNotes', (data) => {
    const notes = data.videoNotes || {};
    const noteContent = notes[videoId] || '';
    
    const notesTextarea = document.getElementById('focustube-notes-content');
    if (notesTextarea) {
      notesTextarea.value = noteContent;
    }
  });
}

/**
 * Save notes for current video
 */
function saveNotes() {
  const videoId = getCurrentVideoId();
  if (!videoId) return;
  
  const notesTextarea = document.getElementById('focustube-notes-content');
  if (!notesTextarea) return;
  
  const noteContent = notesTextarea.value;
  
  chrome.storage.local.get('videoNotes', (data) => {
    const notes = data.videoNotes || {};
    notes[videoId] = noteContent;
    
    chrome.storage.local.set({ videoNotes: notes }, () => {
      // Show save confirmation
      const saveBtn = document.getElementById('focustube-save-notes');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      
      setTimeout(() => {
        saveBtn.textContent = originalText;
      }, 1500);
    });
  });
}

/**
 * Get current video ID
 * @returns {string} - YouTube video ID
 */
function getCurrentVideoId() {
  const url = new URL(window.location.href);
  return url.searchParams.get('v');
}

/**
 * Create a clean home page interface
 */
function createCleanHomePage() {
  // Check if main content area exists
  const contentArea = document.querySelector('ytd-browse');
  if (!contentArea) return;
  
  // Create container for clean interface
  const cleanContainer = document.createElement('div');
  cleanContainer.id = 'youtube-focus-container';
  cleanContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    padding: 20px;
    background-color: #f9f9f9;
    font-family: Roboto, Arial, sans-serif;
  `;
  
  // Add title
  const title = document.createElement('h1');
  title.textContent = 'FocusTube';
  title.style.cssText = `
    font-size: 32px;
    color: #212121;
    margin-bottom: 20px;
  `;
  
  // Add search box
  const searchBox = document.createElement('div');
  searchBox.style.cssText = `
    width: 100%;
    max-width: 600px;
    margin-bottom: 30px;
  `;
  
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search for focused content...';
  searchInput.style.cssText = `
    width: 100%;
    padding: 12px 20px;
    font-size: 16px;
    border: 2px solid #ddd;
    border-radius: 30px;
    outline: none;
    transition: border-color 0.3s;
  `;
  
  searchInput.addEventListener('focus', () => {
    searchInput.style.borderColor = '#1a73e8';
  });
  
  searchInput.addEventListener('blur', () => {
    searchInput.style.borderColor = '#ddd';
  });
  
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        // If agent is enabled, use agent processing, otherwise use clean search page
        if (settings.agentEnabled) {
          window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        } else {
          // Redirect to clean search page
          window.location.href = chrome.runtime.getURL(`pages/search.html?q=${encodeURIComponent(query)}`);
        }
      }
    }
  });
  
  searchBox.appendChild(searchInput);
  
  // Add elements to container
  cleanContainer.appendChild(title);
  cleanContainer.appendChild(searchBox);
  
  // Add FocusTube description
  const description = document.createElement('p');
  description.textContent = 'A distraction-free YouTube experience with intelligent focus assistance';
  description.style.cssText = `
    font-size: 16px;
    color: #606060;
    margin-bottom: 40px;
    text-align: center;
  `;
  cleanContainer.appendChild(description);
  
  // Add agent description if enabled
  if (settings.agentEnabled) {
    const agentInfo = document.createElement('div');
    agentInfo.style.cssText = `
      background-color: #e8f0fe;
      border-radius: 8px;
      padding: 16px 24px;
      max-width: 600px;
      margin-bottom: 20px;
    `;
    
    agentInfo.innerHTML = `
      <h3 style="margin: 0 0 8px 0; color: #1a73e8; font-size: 18px;">FocusTube Agent Active</h3>
      <p style="margin: 0; color: #202124; font-size: 14px;">
        The intelligent assistant is helping you maintain focus and discover valuable content.
        Your personalized experience adapts based on your viewing patterns.
      </p>
    `;
    
    cleanContainer.appendChild(agentInfo);
  }
  
  // Replace content
  contentArea.innerHTML = '';
  contentArea.appendChild(cleanContainer);
}

/**
 * Set up mutation observer to handle dynamically loaded content
 */
function setupMutationObserver() {
  const observer = new MutationObserver((mutations) => {
    // Check if significant DOM changes occurred
    let shouldClean = false;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length > 0) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if important elements were added
            if (
              node.id === 'comments' || 
              node.id === 'related' ||
              node.tagName === 'YTD-COMMENTS' ||
              node.tagName === 'YTD-WATCH-NEXT-SECONDARY-RESULTS-RENDERER' ||
              node.className?.includes('ytd-comments')
            ) {
              shouldClean = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldClean) {
      cleanYouTubePage();
    }
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });
}

// Set up communication with agent interface
window.addEventListener('message', (event) => {
  // Only accept messages from the same frame
  if (event.source !== window) return;
  
  // Process messages from the agent interface
  if (event.data.type === 'FOCUSTUBE_INTERFACE_ACTION') {
    // Forward to background script
    chrome.runtime.sendMessage({
      action: 'agentInterfaceAction',
      data: event.data.data
    });
  }
});