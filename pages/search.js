// YouTube Focus - Search Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const searchInput = document.getElementById('search-input');
  const searchButton = document.getElementById('search-button');
  const searchTermElement = document.getElementById('search-term');
  const resultNumberElement = document.getElementById('result-number');
  const resultsListElement = document.getElementById('results-list');
  const settingsIcon = document.querySelector('.settings-icon');
  const settingsPanel = document.getElementById('settings-panel');
  const closeSettings = document.querySelector('.close-settings');
  const overlay = document.getElementById('overlay');
  const saveSettingsButton = document.getElementById('save-settings');
  
  // Settings inputs
  const maxResultsInput = document.getElementById('max-results');
  const hideCommentsInput = document.getElementById('hide-comments');
  const hideRecommendationsInput = document.getElementById('hide-recommendations');
  const redirectSearchInput = document.getElementById('redirect-search');
  
  // Get settings from storage
  chrome.storage.sync.get(null, (settings) => {
    maxResultsInput.value = settings.maxResults || 20;
    hideCommentsInput.checked = settings.hideComments !== false;
    hideRecommendationsInput.checked = settings.hideRecommendations !== false;
    redirectSearchInput.checked = settings.redirectSearch !== false;
  });
  
  // Parse query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const searchQuery = urlParams.get('q');
  
  // If we have a search query, perform search
  if (searchQuery) {
    searchInput.value = searchQuery;
    searchTermElement.textContent = `Search Results for "${searchQuery}"`;
    performSearch(searchQuery);
  } else {
    // Show empty state
    resultsListElement.innerHTML = `
      <div class="empty-state">
        <div style="text-align: center; padding: 40px 20px;">
          <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <h2 style="margin-top: 20px; color: #606060;">Enter a search term to get started</h2>
          <p style="color: #909090;">We'll show you focused results without distractions</p>
        </div>
      </div>
    `;
  }
  
  // Search button click event
  searchButton.addEventListener('click', () => {
    const query = searchInput.value.trim();
    if (query) {
      // Update URL to reflect the search
      const url = new URL(window.location.href);
      url.searchParams.set('q', query);
      window.history.pushState({}, '', url);
      
      // Update UI and perform search
      searchTermElement.textContent = `Search Results for "${query}"`;
      performSearch(query);
    }
  });
  
  // Search input enter key event
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchButton.click();
    }
  });
  
  // Settings panel toggle
  settingsIcon.addEventListener('click', () => {
    settingsPanel.classList.add('show');
    overlay.classList.add('show');
  });
  
  // Close settings panel
  closeSettings.addEventListener('click', closeSettingsPanel);
  overlay.addEventListener('click', closeSettingsPanel);
  
  // Save settings
  saveSettingsButton.addEventListener('click', () => {
    // Validate max results input
    let maxResults = parseInt(maxResultsInput.value);
    if (isNaN(maxResults) || maxResults < 5) {
      maxResults = 5;
    } else if (maxResults > 50) {
      maxResults = 50;
    }
    
    // Save to storage
    chrome.storage.sync.set({
      maxResults: maxResults,
      hideComments: hideCommentsInput.checked,
      hideRecommendations: hideRecommendationsInput.checked,
      redirectSearch: redirectSearchInput.checked
    }, () => {
      // Close settings panel
      closeSettingsPanel();
      
      // Refresh results if needed
      if (searchQuery) {
        performSearch(searchQuery);
      }
    });
  });
  
  // Logo click to go home
  document.querySelector('.logo').addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('pages/search.html');
  });
  
  /**
   * Close settings panel and overlay
   */
  function closeSettingsPanel() {
    settingsPanel.classList.remove('show');
    overlay.classList.remove('show');
  }
  
  /**
   * Perform search with YouTube Data API
   * @param {string} query - Search query
   */
  function performSearch(query) {
    // Clear previous results
    resultsListElement.innerHTML = `
      <div class="loading-indicator">
        <div class="spinner"></div>
        <p>Loading focused content...</p>
      </div>
    `;
    
    // Get max results from settings
    chrome.storage.sync.get('maxResults', (data) => {
      const maxResults = data.maxResults || 20;
      
      // Use the API handler to search YouTube
      YouTubeAPI.search(query, maxResults)
        .then(videos => {
          displayResults(videos, maxResults);
        })
        .catch(error => {
          resultsListElement.innerHTML = `
            <div class="error-state">
              <div style="text-align: center; padding: 40px 20px;">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ff0000" stroke-width="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12" y2="16" />
                </svg>
                <h2 style="margin-top: 20px; color: #606060;">Error loading results</h2>
                <p style="color: #909090;">${error.message}</p>
              </div>
            </div>
          `;
        });
    });
  }
  
  /**
   * Display search results
   * @param {Array} videos - List of video results
   * @param {number} maxResults - Maximum number of results to display
   */
  function displayResults(videos, maxResults) {
    // Update result count
    const displayCount = Math.min(videos.length, maxResults);
    resultNumberElement.textContent = displayCount;
    
    // Clear loading indicator
    resultsListElement.innerHTML = '';
    
    // Display no results message if needed
    if (videos.length === 0) {
      resultsListElement.innerHTML = `
        <div class="empty-state">
          <div style="text-align: center; padding: 40px 20px;">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 15s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <h2 style="margin-top: 20px; color: #606060;">No results found</h2>
            <p style="color: #909090;">Try a different search term</p>
          </div>
        </div>
      `;
      return;
    }
    
    // Add video cards to results
    videos.slice(0, maxResults).forEach(video => {
      const videoCard = createVideoCard(video);
      resultsListElement.appendChild(videoCard);
    });
  }
  
  /**
   * Create a video card element
   * @param {Object} video - Video data
   * @returns {HTMLElement} - Video card element
   */
  function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.addEventListener('click', () => {
      // Navigate to the YouTube video with our content script active
      window.location.href = `https://www.youtube.com/watch?v=${video.id}`;
    });
    
    // Format duration
    let formattedDuration = 'Live';
    if (video.duration) {
      formattedDuration = formatDuration(video.duration);
    }
    
    // Format view count
    let formattedViews = '';
    if (video.viewCount) {
      formattedViews = formatViewCount(video.viewCount);
    }
    
    // Format publish date
    let formattedDate = '';
    if (video.publishedAt) {
      formattedDate = formatPublishDate(video.publishedAt);
    }
    
    card.innerHTML = `
      <div class="thumbnail-container">
        <img class="video-thumbnail" src="${video.thumbnail}" alt="${video.title}">
        <div class="video-duration">${formattedDuration}</div>
      </div>
      <div class="video-info">
        <h3 class="video-title">${video.title}</h3>
        <div class="video-channel">${video.channelTitle}</div>
        <div class="video-meta">
          <span class="video-views">${formattedViews}</span>
          <span class="video-date">${formattedDate}</span>
        </div>
      </div>
    `;
    
    return card;
  }
  
  /**
   * Format duration from ISO 8601 format
   * @param {string} isoDuration - ISO 8601 duration string
   * @returns {string} - Formatted duration
   */
  function formatDuration(isoDuration) {
    // Parse ISO 8601 duration
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    
    if (!match) return '0:00';
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }
  
  /**
   * Format view count with abbreviations
   * @param {number} viewCount - Number of views
   * @returns {string} - Formatted view count
   */
  function formatViewCount(viewCount) {
    if (viewCount >= 1000000) {
      return `${(viewCount / 1000000).toFixed(1)}M views`;
    } else if (viewCount >= 1000) {
      return `${(viewCount / 1000).toFixed(1)}K views`;
    } else {
      return `${viewCount} views`;
    }
  }
  
  /**
   * Format publish date to relative time
   * @param {string} publishedAt - ISO date string
   * @returns {string} - Relative time string
   */
  function formatPublishDate(publishedAt) {
    const publishDate = new Date(publishedAt);
    const now = new Date();
    
    const diffInSeconds = Math.floor((now - publishDate) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    } else if (diffInSeconds < 31536000) {
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} ${months === 1 ? 'month' : 'months'} ago`;
    } else {
      const years = Math.floor(diffInSeconds / 31536000);
      return `${years} ${years === 1 ? 'year' : 'years'} ago`;
    }
  }
});