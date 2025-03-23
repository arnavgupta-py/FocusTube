// FocusTube - Agent Interface for YouTube
// This script handles the agent UI elements and interaction on YouTube pages

/**
 * Agent interface manager
 * Creates and controls UI elements for agent interaction
 */
class AgentInterface {
    constructor() {
      this.interfaceElements = {
        agentPanel: null,
        messageArea: null,
        suggestionsArea: null,
        controlsArea: null,
        timeDisplay: null
      };
      
      this.isVisible = false;
      this.currentRecommendations = null;
      this.currentVideoId = null;
      this.videoStartTime = null;
      this.interfaceConfig = null;
    }
    
    /**
     * Initialize the agent interface
     * @returns {Promise} - Resolves when initialization is complete
     */
    async initialize() {
      // Create root element for agent interface
      this.createInterfaceElements();
      
      // Initialize interface state based on storage
      await this.loadInterfaceState();
      
      // Set up message passing with background script
      this.setupMessageHandling();
      
      return true;
    }
    
    /**
     * Create UI elements for agent interface
     */
    createInterfaceElements() {
      // Check if elements already exist
      if (document.getElementById('focustube-agent-panel')) {
        return;
      }
      
      // Create agent panel
      const panel = document.createElement('div');
      panel.id = 'focustube-agent-panel';
      panel.className = 'focustube-panel';
      panel.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 350px;
        max-height: 500px;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        overflow: hidden;
        font-family: Roboto, Arial, sans-serif;
        transition: transform 0.3s, opacity 0.3s;
        display: flex;
        flex-direction: column;
      `;
      
      // Panel header
      const header = document.createElement('div');
      header.className = 'focustube-panel-header';
      header.style.cssText = `
        padding: 12px 16px;
        background-color: #4285f4;
        color: white;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 12px 12px 0 0;
      `;
      
      const title = document.createElement('div');
      title.textContent = 'FocusTube Assistant';
      title.style.fontWeight = 'bold';
      
      const controls = document.createElement('div');
      controls.className = 'focustube-panel-controls';
      
      const minimizeBtn = document.createElement('button');
      minimizeBtn.textContent = '−';
      minimizeBtn.className = 'focustube-btn';
      minimizeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        margin-right: 8px;
      `;
      minimizeBtn.title = 'Minimize';
      minimizeBtn.addEventListener('click', () => this.toggleVisibility(false));
      
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.className = 'focustube-btn';
      closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
      `;
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', () => this.hideInterface());
      
      controls.appendChild(minimizeBtn);
      controls.appendChild(closeBtn);
      
      header.appendChild(title);
      header.appendChild(controls);
      
      // Panel content
      const content = document.createElement('div');
      content.className = 'focustube-panel-content';
      content.style.cssText = `
        padding: 16px;
        flex-grow: 1;
        overflow-y: auto;
        max-height: 400px;
      `;
      
      // Message area
      const messageArea = document.createElement('div');
      messageArea.className = 'focustube-message-area';
      messageArea.style.cssText = `
        margin-bottom: 16px;
        font-size: 14px;
        line-height: 1.5;
      `;
      
      // Suggestions area
      const suggestionsArea = document.createElement('div');
      suggestionsArea.className = 'focustube-suggestions-area';
      suggestionsArea.style.cssText = `
        margin-bottom: 16px;
      `;
      
      // Controls area
      const controlsArea = document.createElement('div');
      controlsArea.className = 'focustube-controls-area';
      controlsArea.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
      `;
      
      // Time display
      const timeDisplay = document.createElement('div');
      timeDisplay.className = 'focustube-time-display';
      timeDisplay.style.cssText = `
        font-size: 13px;
        color: #606060;
      `;
      
      // Settings button
      const settingsBtn = document.createElement('button');
      settingsBtn.textContent = 'Settings';
      settingsBtn.className = 'focustube-settings-btn';
      settingsBtn.style.cssText = `
        background-color: #f1f1f1;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        font-size: 13px;
        cursor: pointer;
      `;
      settingsBtn.addEventListener('click', () => this.openSettings());
      
      // Add elements to panel
      controlsArea.appendChild(timeDisplay);
      controlsArea.appendChild(settingsBtn);
      
      content.appendChild(messageArea);
      content.appendChild(suggestionsArea);
      content.appendChild(controlsArea);
      
      panel.appendChild(header);
      panel.appendChild(content);
      
      // Store references to elements
      this.interfaceElements = {
        agentPanel: panel,
        messageArea,
        suggestionsArea,
        controlsArea,
        timeDisplay
      };
      
      // Hide the panel initially
      panel.style.transform = 'translateY(120%)';
      panel.style.opacity = '0';
      
      // Create minimized button for showing the panel
      this.createMinimizedButton();
      
      // Add to page
      document.body.appendChild(panel);
    }
    
    /**
     * Create minimized button for showing the interface
     */
    createMinimizedButton() {
      // Check if already exists
      if (document.getElementById('focustube-minimized-btn')) {
        return;
      }
      
      const minBtn = document.createElement('button');
      minBtn.id = 'focustube-minimized-btn';
      minBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background-color: #4285f4;
        color: white;
        border: none;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        cursor: pointer;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        transition: transform 0.3s, opacity 0.3s;
      `;
      minBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v4m0 4h.01"></path></svg>`;
      minBtn.title = 'FocusTube Assistant';
      
      // Add click handler
      minBtn.addEventListener('click', () => this.toggleVisibility(true));
      
      // Add to page
      document.body.appendChild(minBtn);
    }
    
    /**
     * Load interface state from storage
     * @returns {Promise} - Resolves when state is loaded
     */
    async loadInterfaceState() {
      return new Promise((resolve) => {
        chrome.storage.sync.get('agentInterfaceState', (data) => {
          if (data.agentInterfaceState) {
            this.isVisible = data.agentInterfaceState.isVisible || false;
          }
          
          // Apply visibility state
          this.toggleVisibility(this.isVisible, false);
          
          resolve(true);
        });
      });
    }
    
    /**
     * Save interface state to storage
     * @returns {Promise} - Resolves when state is saved
     */
    async saveInterfaceState() {
      return new Promise((resolve) => {
        chrome.storage.sync.set({
          agentInterfaceState: {
            isVisible: this.isVisible
          }
        }, resolve);
      });
    }
    
    /**
     * Set up message handling with background script
     */
    setupMessageHandling() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'updateAgentInterface') {
          if (message.data.message) {
            this.showMessage(message.data.message);
          }
          
          if (message.data.recommendations) {
            this.showRecommendations(message.data.recommendations);
          }
          
          if (message.data.timeRemaining !== undefined) {
            this.updateTimeDisplay(message.data.timeRemaining);
          }
          
          if (message.data.interfaceConfig) {
            this.applyInterfaceConfig(message.data.interfaceConfig);
          }
          
          if (message.data.show !== undefined) {
            this.toggleVisibility(message.data.show);
          }
          
          sendResponse({ success: true });
          return true;
        }
        
        return false;
      });
    }
    
    /**
     * Toggle interface visibility
     * @param {boolean} visible - Whether interface should be visible
     * @param {boolean} save - Whether to save state to storage
     */
    toggleVisibility(visible, save = true) {
      this.isVisible = visible;
      
      // Update panel visibility
      if (this.interfaceElements.agentPanel) {
        if (visible) {
          this.interfaceElements.agentPanel.style.transform = 'translateY(0)';
          this.interfaceElements.agentPanel.style.opacity = '1';
        } else {
          this.interfaceElements.agentPanel.style.transform = 'translateY(120%)';
          this.interfaceElements.agentPanel.style.opacity = '0';
        }
      }
      
      // Update minimized button visibility
      const minBtn = document.getElementById('focustube-minimized-btn');
      if (minBtn) {
        minBtn.style.transform = visible ? 'scale(0)' : 'scale(1)';
        minBtn.style.opacity = visible ? '0' : '1';
      }
      
      // Save state if requested
      if (save) {
        this.saveInterfaceState();
      }
    }
    
    /**
     * Hide the interface completely
     */
    hideInterface() {
      // Hide both panel and button
      if (this.interfaceElements.agentPanel) {
        this.interfaceElements.agentPanel.style.display = 'none';
      }
      
      const minBtn = document.getElementById('focustube-minimized-btn');
      if (minBtn) {
        minBtn.style.display = 'none';
      }
      
      // Notify background script that interface is hidden
      chrome.runtime.sendMessage({
        action: 'agentInterfaceHidden'
      });
    }
    
    /**
     * Show a message in the agent interface
     * @param {string} message - Message text
     */
    showMessage(message) {
      if (!this.interfaceElements.messageArea) return;
      
      this.interfaceElements.messageArea.innerHTML = `
        <p>${message}</p>
      `;
    }
    
    /**
     * Show recommendations in the agent interface
     * @param {Object} recommendations - Recommendation data
     */
    showRecommendations(recommendations) {
      if (!this.interfaceElements.suggestionsArea) return;
      
      this.currentRecommendations = recommendations;
      let html = '';
      
      // Handle different recommendation types
      switch (recommendations.type) {
        case 'break':
          html = `
            <div class="focustube-break-recommendation">
              <h3 style="font-size: 15px; margin: 0 0 8px 0; color: #d93025;">Time for a break</h3>
              <p style="margin: 0 0 12px 0; font-size: 14px;">${recommendations.message}</p>
              <div style="display: flex; gap: 8px;">
                <button class="focustube-action-btn" data-action="startBreak" 
                  style="background-color: #4285f4; color: white; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer;">
                  Start ${recommendations.duration}-min Break
                </button>
                <button class="focustube-action-btn" data-action="ignoreSuggestion"
                  style="background-color: #f1f1f1; color: #333; border: none; border-radius: 4px; padding: 8px 12px; cursor: pointer;">
                  Ignore
                </button>
              </div>
            </div>
          `;
          break;
          
        case 'learning-path':
          html = `
            <div class="focustube-learning-recommendation">
              <h3 style="font-size: 15px; margin: 0 0 8px 0; color: #1a73e8;">Learning Recommendations</h3>
              <p style="margin: 0 0 12px 0; font-size: 14px;">${recommendations.message}</p>
              <div class="focustube-recommendations" style="display: flex; flex-direction: column; gap: 8px;">
          `;
          
          recommendations.recommendations.forEach((rec, index) => {
            html += `
              <div class="focustube-recommendation-item" style="padding: 8px; background-color: #f8f9fa; border-radius: 4px;">
                <div style="font-weight: 500; margin-bottom: 4px;">${rec.nextTopic}</div>
                <div style="font-size: 12px; color: #606060; margin-bottom: 6px;">Part of: ${rec.currentPath}</div>
                <button class="focustube-action-btn" data-action="searchRecommendation" data-query="${rec.searchQuery}"
                  style="background-color: #f1f1f1; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">
                  Search
                </button>
              </div>
            `;
          });
          
          html += `
              </div>
            </div>
          `;
          break;
          
        case 'related-content':
          html = `
            <div class="focustube-related-recommendation">
              <h3 style="font-size: 15px; margin: 0 0 8px 0; color: #1a73e8;">You might also like</h3>
              <p style="margin: 0 0 12px 0; font-size: 14px;">${recommendations.message}</p>
              <div class="focustube-recommendations" style="display: flex; flex-direction: column; gap: 8px;">
          `;
          
          recommendations.recommendations.forEach((rec, index) => {
            html += `
              <div class="focustube-recommendation-item" style="padding: 8px; background-color: #f8f9fa; border-radius: 4px;">
                <div style="font-weight: 500; margin-bottom: 4px;">${rec.reason}</div>
                <button class="focustube-action-btn" data-action="searchRecommendation" data-query="${rec.searchQuery}"
                  style="background-color: #f1f1f1; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 12px;">
                  Explore
                </button>
              </div>
            `;
          });
          
          html += `
              </div>
            </div>
          `;
          break;
          
        case 'standard':
        default:
          if (recommendations.timeRemaining) {
            html = `
              <div class="focustube-time-recommendation">
                <p style="font-size: 14px; margin: 0;">${recommendations.message}</p>
              </div>
            `;
          }
          break;
      }
      
      // Update recommendations area
      this.interfaceElements.suggestionsArea.innerHTML = html;
      
      // Add event listeners to buttons
      const actionButtons = this.interfaceElements.suggestionsArea.querySelectorAll('.focustube-action-btn');
      actionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          const action = button.getAttribute('data-action');
          const query = button.getAttribute('data-query');
          
          this.handleRecommendationAction(action, query);
        });
      });
    }
    
    /**
     * Handle a recommendation action button click
     * @param {string} action - Action to take
     * @param {string} data - Additional action data
     */
    handleRecommendationAction(action, data) {
      switch (action) {
        case 'startBreak':
          this.startBreakMode();
          break;
          
        case 'searchRecommendation':
          if (data) {
            window.location.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(data)}`;
          }
          break;
          
        case 'ignoreSuggestion':
          // Clear recommendation area and notify background script
          this.interfaceElements.suggestionsArea.innerHTML = '';
          chrome.runtime.sendMessage({
            action: 'recommendationIgnored',
            data: { type: this.currentRecommendations?.type }
          });
          break;
      }
    }
    
    /**
     * Start break mode
     */
    startBreakMode() {
      // Overlay the YouTube page with a break screen
      const breakOverlay = document.createElement('div');
      breakOverlay.id = 'focustube-break-overlay';
      breakOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(33, 33, 33, 0.9);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-family: Roboto, Arial, sans-serif;
      `;
      
      const breakDuration = this.currentRecommendations?.duration || 5;
      const breakEndTime = Date.now() + (breakDuration * 60 * 1000);
      
      breakOverlay.innerHTML = `
        <h2 style="font-size: 28px; margin-bottom: 16px;">Time for a break!</h2>
        <p style="font-size: 16px; margin-bottom: 32px; max-width: 500px; text-align: center;">
          Taking regular breaks helps maintain focus and productivity. Try stepping away from the screen for a bit.
        </p>
        <div id="focustube-break-timer" style="font-size: 48px; font-weight: bold; margin-bottom: 40px;">
          ${breakDuration}:00
        </div>
        <button id="focustube-end-break" style="background-color: #4285f4; color: white; border: none; border-radius: 4px; padding: 12px 24px; cursor: pointer; font-size: 16px;">
          End Break
        </button>
      `;
      
      document.body.appendChild(breakOverlay);
      
      // Set up timer
      let secondsLeft = breakDuration * 60;
      const timerElement = document.getElementById('focustube-break-timer');
      
      const breakTimer = setInterval(() => {
        secondsLeft--;
        
        if (secondsLeft <= 0) {
          clearInterval(breakTimer);
          document.body.removeChild(breakOverlay);
          
          // Notify background script that break is completed
          chrome.runtime.sendMessage({
            action: 'breakCompleted',
            data: { duration: breakDuration }
          });
        } else {
          const minutes = Math.floor(secondsLeft / 60);
          const seconds = secondsLeft % 60;
          timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
      }, 1000);
      
      // Set up end break button
      document.getElementById('focustube-end-break').addEventListener('click', () => {
        clearInterval(breakTimer);
        document.body.removeChild(breakOverlay);
        
        // Notify background script that break was ended early
        chrome.runtime.sendMessage({
          action: 'breakEnded',
          data: { 
            duration: breakDuration,
            actualDuration: (breakDuration * 60 - secondsLeft) / 60
          }
        });
      });
    }
    
    /**
     * Update time display
     * @param {number} minutes - Time remaining in minutes
     */
    updateTimeDisplay(minutes) {
      if (!this.interfaceElements.timeDisplay) return;
      
      if (minutes !== null && minutes !== undefined) {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        
        let timeText = '';
        if (hours > 0) {
          timeText = `${hours}h ${mins}m remaining`;
        } else {
          timeText = `${mins}m remaining`;
        }
        
        this.interfaceElements.timeDisplay.textContent = timeText;
        this.interfaceElements.timeDisplay.style.display = 'block';
      } else {
        this.interfaceElements.timeDisplay.style.display = 'none';
      }
    }
    
    /**
     * Apply interface configuration to YouTube page
     * @param {Object} config - Interface configuration
     */
    applyInterfaceConfig(config) {
      this.interfaceConfig = config;
      
      // Apply different configurations based on settings
      if (config.hideComments) {
        this.hideComments();
      }
      
      if (!config.showRelatedVideos) {
        this.hideRelatedVideos();
      }
      
      if (config.showTranscript) {
        this.showTranscript();
      }
      
      if (config.noteMode) {
        this.enableNoteMode();
      }
      
      if (config.playbackRate && config.playbackRate !== 1.0) {
        this.setPlaybackRate(config.playbackRate);
      }
    }
    
    /**
     * Hide comments on YouTube page
     */
    hideComments() {
      const style = document.createElement('style');
      style.id = 'focustube-hide-comments';
      style.textContent = `
        #comments { display: none !important; }
        ytd-comments { display: none !important; }
      `;
      document.head.appendChild(style);
    }
    
    /**
     * Hide related videos on YouTube page
     */
    hideRelatedVideos() {
      const style = document.createElement('style');
      style.id = 'focustube-hide-related';
      style.textContent = `
        #related { display: none !important; }
        ytd-watch-next-secondary-results-renderer { display: none !important; }
      `;
      document.head.appendChild(style);
    }
    
    /**
     * Show transcript panel
     */
    showTranscript() {
      // Find the "Show transcript" button and click it if it exists
      setTimeout(() => {
        const menuItems = document.querySelectorAll('tp-yt-paper-item');
        for (const item of menuItems) {
          if (item.textContent.includes('Show transcript')) {
            item.click();
            break;
          }
        }
      }, 2000);
    }
    
    /**
     * Enable note-taking mode
     */
    enableNoteMode() {
      // Create a note-taking panel
      if (document.getElementById('focustube-notes-panel')) {
        return;
      }
      
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
      this.loadNotes();
      
      // Set up event listeners
      document.getElementById('focustube-close-notes').addEventListener('click', () => {
        notesPanel.style.display = 'none';
      });
      
      document.getElementById('focustube-save-notes').addEventListener('click', () => {
        this.saveNotes();
      });
      
      document.getElementById('focustube-clear-notes').addEventListener('click', () => {
        document.getElementById('focustube-notes-content').value = '';
        this.saveNotes();
      });
    }
    
    /**
     * Load notes for current video
     */
    loadNotes() {
      const videoId = this.getCurrentVideoId();
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
    saveNotes() {
      const videoId = this.getCurrentVideoId();
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
     * Set playback rate for the video
     * @param {number} rate - Playback rate
     */
    setPlaybackRate(rate) {
      // Wait for video element to be available
      setTimeout(() => {
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.playbackRate = rate;
          
          // Inform user of playback rate change
          this.showMessage(`Playback speed set to ${rate}x based on your viewing patterns`);
        }
      }, 1000);
    }
    
    /**
     * Get current video ID
     * @returns {string} - YouTube video ID
     */
    getCurrentVideoId() {
      const url = new URL(window.location.href);
      return url.searchParams.get('v');
    }
    
    /**
     * Open settings panel
     */
    openSettings() {
      // Create settings overlay if it doesn't exist
      if (document.getElementById('focustube-settings-overlay')) {
        document.getElementById('focustube-settings-overlay').style.display = 'flex';
        return;
      }
      
      const settingsOverlay = document.createElement('div');
      settingsOverlay.id = 'focustube-settings-overlay';
      settingsOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.6);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: Roboto, Arial, sans-serif;
      `;
      
      // Settings panel
      const settingsPanel = document.createElement('div');
      settingsPanel.className = 'focustube-settings-panel';
      settingsPanel.style.cssText = `
        background-color: white;
        border-radius: 8px;
        width: 500px;
        max-width: 90%;
        max-height: 90%;
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      `;
      
      settingsPanel.innerHTML = `
        <div style="padding: 16px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 20px;">FocusTube Settings</h2>
          <button id="focustube-close-settings" style="background: none; border: none; font-size: 20px; cursor: pointer;">×</button>
        </div>
        
        <div style="padding: 16px 24px;">
          <h3 style="font-size: 16px; margin: 0 0 16px 0;">Agent Features</h3>
          
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="focustube-agent-enabled" style="margin-right: 8px;">
              <span>Enable FocusTube Agent</span>
            </label>
            <p style="margin: 4px 0 0 24px; font-size: 13px; color: #606060;">
              The intelligent assistant helps provide a more focused YouTube experience
            </p>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="focustube-learning-mode" style="margin-right: 8px;">
              <span>Learning Mode</span>
            </label>
            <p style="margin: 4px 0 0 24px; font-size: 13px; color: #606060;">
              Optimizes for educational content and knowledge building
            </p>
          </div>
          
          <h3 style="font-size: 16px; margin: 24px 0 16px 0;">Time Management</h3>
          
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="focustube-time-management" style="margin-right: 8px;">
              <span>Enable Time Management</span>
            </label>
            <p style="margin: 4px 0 0 24px; font-size: 13px; color: #606060;">
              Get alerts when you've spent too much time on YouTube
            </p>
          </div>
          
          <div style="margin-bottom: 16px; padding-left: 24px;">
            <label style="display: block; margin-bottom: 8px;">
              Daily Time Limit (minutes)
            </label>
            <input type="number" id="focustube-daily-limit" min="5" max="240" 
              style="width: 80px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          
          <div style="margin-bottom: 16px; padding-left: 24px;">
            <label style="display: block; margin-bottom: 8px;">
              Break Duration (minutes)
            </label>
            <input type="number" id="focustube-break-duration" min="1" max="60" 
              style="width: 80px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
          </div>
          
          <h3 style="font-size: 16px; margin: 24px 0 16px 0;">Privacy Settings</h3>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px;">
              Data Collection Level
            </label>
            <select id="focustube-privacy-level" 
              style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
              <option value="minimal">Minimal - Store only essential data</option>
              <option value="moderate">Moderate - Balance between privacy and recommendations</option>
              <option value="full">Full - Best recommendations with complete data collection</option>
            </select>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #606060;">
              Controls how much data the agent collects to improve recommendations
            </p>
          </div>
          
          <div style="margin-top: 24px;">
            <button id="focustube-reset-data" 
              style="background-color: #f1f1f1; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer;">
              Reset All Agent Data
            </button>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #606060;">
              Clears all learned preferences and usage data
            </p>
          </div>
        </div>
        
        <div style="padding: 16px; border-top: 1px solid #eee; display: flex; justify-content: flex-end;">
          <button id="focustube-save-settings" 
            style="background-color: #4285f4; color: white; border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer;">
            Save Settings
          </button>
        </div>
      `;
      
      settingsOverlay.appendChild(settingsPanel);
      document.body.appendChild(settingsOverlay);
      
      // Load current settings
      this.loadSettings();
      
      // Set up event listeners
      document.getElementById('focustube-close-settings').addEventListener('click', () => {
        settingsOverlay.style.display = 'none';
      });
      
      document.getElementById('focustube-save-settings').addEventListener('click', () => {
        this.saveSettings();
        settingsOverlay.style.display = 'none';
      });
      
      document.getElementById('focustube-reset-data').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all agent data? This will clear all learned preferences and cannot be undone.')) {
          chrome.runtime.sendMessage({
            action: 'resetAgentData'
          }, () => {
            alert('Agent data has been reset successfully.');
          });
        }
      });
    }
    
    /**
     * Load settings into the settings panel
     */
    loadSettings() {
      chrome.storage.sync.get(['agentPreferences', 'privacySettings'], (data) => {
        const prefs = data.agentPreferences || {};
        const privacy = data.privacySettings || {};
        
        // Set form values
        document.getElementById('focustube-agent-enabled').checked = prefs.agentEnabled !== false;
        document.getElementById('focustube-learning-mode').checked = prefs.learningMode === true;
        
        document.getElementById('focustube-time-management').checked = 
          prefs.timeManagement?.enabled !== false;
        
        document.getElementById('focustube-daily-limit').value = 
          prefs.timeManagement?.dailyLimit || 60;
        
        document.getElementById('focustube-break-duration').value = 
          prefs.timeManagement?.breakDuration || 10;
        
        document.getElementById('focustube-privacy-level').value = 
          privacy.privacyLevel || 'moderate';
      });
    }
    
    /**
     * Save settings from the settings panel
     */
    saveSettings() {
      const agentEnabled = document.getElementById('focustube-agent-enabled').checked;
      const learningMode = document.getElementById('focustube-learning-mode').checked;
      const timeManagementEnabled = document.getElementById('focustube-time-management').checked;
      const dailyLimit = parseInt(document.getElementById('focustube-daily-limit').value) || 60;
      const breakDuration = parseInt(document.getElementById('focustube-break-duration').value) || 10;
      const privacyLevel = document.getElementById('focustube-privacy-level').value;
      
      // Update preferences
      const agentPreferences = {
        agentEnabled,
        learningMode,
        timeManagement: {
          enabled: timeManagementEnabled,
          dailyLimit: Math.max(5, Math.min(240, dailyLimit)),
          breakDuration: Math.max(1, Math.min(60, breakDuration))
        }
      };
      
      // Update privacy settings
      const privacySettings = {
        privacyLevel,
        collectionEnabled: agentEnabled
      };
      
      // Save to storage
      chrome.storage.sync.set({ 
        agentPreferences, 
        privacySettings
      }, () => {
        // Notify background script of settings change
        chrome.runtime.sendMessage({
          action: 'settingsUpdated',
          data: {
            agentPreferences,
            privacySettings
          }
        });
      });
    }
  }
  
  // Initialize the agent interface
  const agentInterface = new AgentInterface();
  agentInterface.initialize();
  
  // Track video interactions if on a video page
  if (window.location.href.includes('youtube.com/watch')) {
    // Set up video tracking
    const videoElement = document.querySelector('video');
    
    if (videoElement) {
      // Get video ID
      const videoId = new URL(window.location.href).searchParams.get('v');
      
      // Notify background script that video started
      chrome.runtime.sendMessage({
        action: 'videoStarted',
        data: {
          videoId,
          startTime: Date.now()
        }
      });
      
      // Track video events
      videoElement.addEventListener('pause', () => {
        chrome.runtime.sendMessage({
          action: 'videoEvent',
          data: {
            videoId,
            eventType: 'pause',
            currentTime: videoElement.currentTime
          }
        });
      });
      
      videoElement.addEventListener('play', () => {
        chrome.runtime.sendMessage({
          action: 'videoEvent',
          data: {
            videoId,
            eventType: 'play',
            currentTime: videoElement.currentTime
          }
        });
      });
      
      videoElement.addEventListener('seeked', () => {
        chrome.runtime.sendMessage({
          action: 'videoEvent',
          data: {
            videoId,
            eventType: 'seek',
            currentTime: videoElement.currentTime
          }
        });
      });
      
      videoElement.addEventListener('ended', () => {
        chrome.runtime.sendMessage({
          action: 'videoEvent',
          data: {
            videoId,
            eventType: 'ended',
            currentTime: videoElement.currentTime
          }
        });
      });
      
      // Track video progress
      setInterval(() => {
        if (!videoElement.paused) {
          chrome.runtime.sendMessage({
            action: 'videoEvent',
            data: {
              videoId,
              eventType: 'timeUpdate',
              currentTime: videoElement.currentTime
            }
          });
        }
      }, 5000); // Update every 5 seconds
      
      // Handle page unload
      window.addEventListener('beforeunload', () => {
        chrome.runtime.sendMessage({
          action: 'videoLeft',
          data: {
            videoId,
            endTime: Date.now(),
            watchDuration: videoElement.currentTime
          }
        });
      });
    }
  }