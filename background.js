// FocusTube Extension - Background Script

// Global agent instance
let focusTubeAgent = null;

// Listen for extension installation
chrome.runtime.onInstalled.addListener(() => {
  // Initialize extension settings
  chrome.storage.sync.set({
    enabled: true,          // Extension enabled by default
    maxResults: 20,         // Maximum number of search results to show
    hideComments: true,     // Hide comments by default
    hideRecommendations: true, // Hide video recommendations
    redirectSearch: true,    // Redirect YouTube search to clean interface
    
    // Initial agent preferences
    agentPreferences: {
      agentEnabled: true,
      learningMode: false,
      timeManagement: {
        enabled: true,
        dailyLimit: 60,
        breakDuration: 10
      }
    },
    
    // Initial privacy settings
    privacySettings: {
      privacyLevel: 'moderate',
      collectionEnabled: true
    }
  });
  
  console.log('FocusTube extension installed with default settings');
  
  // Initialize the agent system
  initializeAgent();
});

// Initialize agent system
async function initializeAgent() {
  try {
    console.log('Initializing FocusTube Agent');
    
    // Create new agent instance
    focusTubeAgent = new FocusTubeAgent();
    
    // Initialize the agent
    const initialized = await focusTubeAgent.initialize();
    
    if (initialized) {
      console.log('FocusTube Agent initialized successfully');
    } else {
      console.error('FocusTube Agent initialization failed');
    }
  } catch (error) {
    console.error('Agent initialization error:', error);
  }
}

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  // Toggle extension state when icon is clicked
  chrome.storage.sync.get('enabled', (data) => {
    const newEnabledState = !data.enabled;
    chrome.storage.sync.set({ enabled: newEnabledState });
    
    // Update icon to reflect current state
    const iconPath = newEnabledState ? 'icons/icon48.png' : 'icons/icon48-disabled.png';
    chrome.action.setIcon({ path: iconPath });
    
    // Refresh the current tab to apply changes
    chrome.tabs.reload(tab.id);
  });
});

// Listen for YouTube navigation events
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // Check if the URL is a YouTube page
  if (details.url.includes('youtube.com')) {
    chrome.storage.sync.get(['enabled', 'agentPreferences'], async (data) => {
      const extensionEnabled = data.enabled !== false;
      const agentEnabled = data.agentPreferences?.agentEnabled !== false;
      
      if (extensionEnabled) {
        // Check if this is a search page that should be redirected
        if (details.url.includes('youtube.com/results') && data.redirectSearch) {
          // Extract the search query
          const url = new URL(details.url);
          const searchQuery = url.searchParams.get('search_query');
          
          if (searchQuery) {
            if (agentEnabled && focusTubeAgent) {
              // Process search with agent
              try {
                const results = await focusTubeAgent.processSearch(searchQuery);
                
                // If agent returns standard results, redirect to clean search page
                if (results.useStandard) {
                  // Redirect to our clean search page with the query
                  chrome.tabs.update(details.tabId, {
                    url: chrome.runtime.getURL(`pages/search.html?q=${encodeURIComponent(searchQuery)}`)
                  });
                } else {
                  // Send agent results to the content script
                  chrome.tabs.sendMessage(details.tabId, {
                    action: 'updateAgentInterface',
                    data: {
                      message: results.agentMessage,
                      recommendations: {
                        type: 'search',
                        results: results.results
                      },
                      interfaceConfig: results.interfaceConfig,
                      show: true
                    }
                  });
                }
              } catch (error) {
                console.error('Search processing error:', error);
                
                // Fall back to standard redirect on error
                chrome.tabs.update(details.tabId, {
                  url: chrome.runtime.getURL(`pages/search.html?q=${encodeURIComponent(searchQuery)}`)
                });
              }
            } else {
              // Standard redirect without agent
              chrome.tabs.update(details.tabId, {
                url: chrome.runtime.getURL(`pages/search.html?q=${encodeURIComponent(searchQuery)}`)
              });
            }
          }
        }
        
        // Apply content script to clean up the page
        chrome.tabs.sendMessage(details.tabId, { action: 'cleanPage' });
      }
    });
  }
}, { url: [{ hostContains: 'youtube.com' }] });

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    // Return all settings
    chrome.storage.sync.get(null, (settings) => {
      sendResponse(settings);
    });
    return true; // Required for async response
  }
  
  if (request.action === 'videoStarted' && focusTubeAgent) {
    // Get video details
    const videoId = request.data.videoId;
    fetchVideoDetails(videoId)
      .then(videoData => {
        // Process video with agent
        const videoTracking = focusTubeAgent.processVideoView(videoId, videoData);
        
        // If tracking is enabled, start session
        if (videoTracking.tracking) {
          // Set up interface for video
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'updateAgentInterface',
            data: {
              message: `FocusTube is helping you focus on this video.`,
              interfaceConfig: focusTubeAgent.intentAgent.getInterfaceConfiguration(),
              show: true
            }
          });
        }
      })
      .catch(error => {
        console.error('Error processing video start:', error);
      });
  }
  
  if (request.action === 'videoEvent' && focusTubeAgent) {
    // Forward video events to the data collector
    const dataCollector = focusTubeAgent.dataCollector;
    if (dataCollector) {
      dataCollector.trackVideoEvent(
        request.data.eventType,
        request.data
      );
    }
  }
  
  if (request.action === 'videoLeft' && focusTubeAgent) {
    // Process video end with agent
    const videoId = request.data.videoId;
    const watchDuration = request.data.watchDuration * 1000; // Convert to milliseconds
    
    // Get video tracking from agent
    fetchVideoDetails(videoId)
      .then(videoData => {
        // Get video handler from agent
        const videoTracking = focusTubeAgent.processVideoView(videoId, videoData);
        
        // Call videoEnded handler
        if (videoTracking.videoEnded) {
          videoTracking.videoEnded(watchDuration)
            .then(recommendations => {
              // Save session data
              const dataCollector = focusTubeAgent.dataCollector;
              if (dataCollector) {
                dataCollector.saveSessionData();
              }
            })
            .catch(error => {
              console.error('Error processing video end:', error);
            });
        }
      })
      .catch(error => {
        console.error('Error processing video left:', error);
      });
  }
  
  if (request.action === 'settingsUpdated' && focusTubeAgent) {
    // Update agent settings
    if (request.data.agentPreferences) {
      focusTubeAgent.userPreferences = request.data.agentPreferences;
      focusTubeAgent.saveUserPreferences();
    }
    
    // Update privacy settings
    if (request.data.privacySettings && focusTubeAgent.dataCollector) {
      focusTubeAgent.dataCollector.updatePrivacySettings(
        request.data.privacySettings.privacyLevel,
        request.data.privacySettings.collectionEnabled
      );
    }
  }
  
  if (request.action === 'resetAgentData' && focusTubeAgent) {
    // Reset all agent data
    focusTubeAgent.resetAgentData()
      .then(success => {
        sendResponse({ success });
      })
      .catch(error => {
        console.error('Error resetting agent data:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Required for async response
  }
  
  if (request.action === 'breakCompleted' || request.action === 'breakEnded') {
    // Update the time agent after a break
    if (focusTubeAgent && focusTubeAgent.timeAgent) {
      // Record break completion
      console.log(`Break ${request.action === 'breakCompleted' ? 'completed' : 'ended early'}: ${request.data.duration} minutes`);
    }
  }
  
  if (request.action === 'recommendationIgnored') {
    // Record that user ignored a recommendation
    console.log(`User ignored ${request.data.type} recommendation`);
  }
  
  return false;
});

/**
 * Fetch video details from YouTube API
 * @param {string} videoId - YouTube video ID
 * @returns {Promise<Object>} - Video details
 */
async function fetchVideoDetails(videoId) {
  try {
    // Try to get video details from YouTube API
    // For development, return placeholder data
    return {
      id: videoId,
      title: `Video ${videoId}`,
      description: 'Video description',
      channelId: 'sample-channel',
      channelTitle: 'Sample Channel',
      duration: 'PT10M30S',
      viewCount: 100000,
      publishedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error fetching video details:', error);
    throw error;
  }
}

// Initialize agent on extension startup
initializeAgent();