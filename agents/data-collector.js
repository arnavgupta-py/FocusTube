// FocusTube - Agent Data Collection Utilities
// This module handles safe collection of usage data for agent learning

/**
 * Data collection utilities for agent learning
 * with privacy safeguards and controls
 */
class AgentDataCollector {
    constructor() {
      this.privacyLevel = 'moderate'; // 'minimal', 'moderate', 'full'
      this.collectionEnabled = true;
      this.currentVideoData = null;
      this.sessionData = {
        startTime: null,
        events: [],
        videoInteractions: []
      };
      
      // Data collection consent
      this.userConsent = {
        consentGiven: false,
        consentDate: null,
        consentLevel: null
      };
    }
    
    /**
     * Initialize the data collector
     * @returns {Promise} - Resolves when initialization is complete
     */
    async initialize() {
      return new Promise((resolve) => {
        // Load previous settings and consent data
        chrome.storage.sync.get(['privacySettings', 'userConsent'], (data) => {
          if (data.privacySettings) {
            this.privacyLevel = data.privacySettings.privacyLevel || 'moderate';
            this.collectionEnabled = data.privacySettings.collectionEnabled !== false;
          }
          
          if (data.userConsent) {
            this.userConsent = data.userConsent;
          }
          
          // Start a new session
          this.startNewSession();
          
          resolve(true);
        });
      });
    }
    
    /**
     * Start a new data collection session
     */
    startNewSession() {
      this.sessionData = {
        startTime: Date.now(),
        events: [],
        videoInteractions: []
      };
    }
    
    /**
     * Set current video data for tracking
     * @param {Object} videoData - Video metadata
     */
    setCurrentVideo(videoData) {
      // Only collect video data if collection is enabled and consent given
      if (!this.collectionEnabled || !this.userConsent.consentGiven) {
        this.currentVideoData = null;
        return;
      }
      
      // Sanitize video data based on privacy level
      this.currentVideoData = this.sanitizeVideoData(videoData);
      
      // Add video to interactions list
      this.sessionData.videoInteractions.push({
        videoId: videoData.id,
        startTime: Date.now(),
        events: [],
        watchDuration: 0,
        completed: false
      });
    }
    
    /**
     * Track a video event (pause, play, seek, etc.)
     * @param {string} eventType - Type of event
     * @param {Object} eventData - Event data
     */
    trackVideoEvent(eventType, eventData = {}) {
      // Only track if collection is enabled and we have current video data
      if (!this.collectionEnabled || !this.userConsent.consentGiven || !this.currentVideoData) {
        return;
      }
      
      // Find current video interaction
      const currentInteraction = this.sessionData.videoInteractions.find(
        interaction => interaction.videoId === this.currentVideoData.id
      );
      
      if (!currentInteraction) {
        return;
      }
      
      // Add event to interaction events
      currentInteraction.events.push({
        type: eventType,
        timestamp: Date.now(),
        data: this.sanitizeEventData(eventData)
      });
      
      // Update watch duration for certain events
      if (eventType === 'timeUpdate') {
        currentInteraction.watchDuration = eventData.currentTime || 0;
      } else if (eventType === 'ended') {
        currentInteraction.completed = true;
      }
    }
    
    /**
     * Track a search event
     * @param {string} query - Search query
     * @param {Array} results - Search results
     */
    trackSearchEvent(query, results = []) {
      // Only track if collection is enabled and consent given
      if (!this.collectionEnabled || !this.userConsent.consentGiven) {
        return;
      }
      
      // Add search event to session events
      this.sessionData.events.push({
        type: 'search',
        timestamp: Date.now(),
        data: {
          query: query,
          resultCount: results.length
        }
      });
    }
    
    /**
     * Track a UI interaction event
     * @param {string} elementType - Type of UI element
     * @param {string} action - Action performed
     * @param {Object} metadata - Additional metadata
     */
    trackUIEvent(elementType, action, metadata = {}) {
      // Only track if collection is enabled and consent given
      if (!this.collectionEnabled || !this.userConsent.consentGiven) {
        return;
      }
      
      // Add UI event to session events
      this.sessionData.events.push({
        type: 'uiInteraction',
        timestamp: Date.now(),
        data: {
          element: elementType,
          action: action,
          metadata: this.sanitizeEventData(metadata)
        }
      });
    }
    
    /**
     * Save session data to storage
     * @returns {Promise} - Resolves when data is saved
     */
    async saveSessionData() {
      // Only save if collection is enabled and consent given
      if (!this.collectionEnabled || !this.userConsent.consentGiven) {
        return Promise.resolve(false);
      }
      
      return new Promise((resolve) => {
        // Get existing sessions data
        chrome.storage.local.get('agentSessionData', (data) => {
          let sessions = data.agentSessionData || [];
          
          // Add current session
          sessions.push({
            sessionId: `session_${this.sessionData.startTime}`,
            startTime: this.sessionData.startTime,
            endTime: Date.now(),
            events: this.sessionData.events,
            videoInteractions: this.sessionData.videoInteractions
          });
          
          // Limit stored sessions based on privacy level
          const sessionLimit = this.getSessionLimit();
          if (sessions.length > sessionLimit) {
            sessions = sessions.slice(-sessionLimit);
          }
          
          // Save back to storage
          chrome.storage.local.set({ agentSessionData: sessions }, () => {
            // Start new session for next data
            this.startNewSession();
            resolve(true);
          });
        });
      });
    }
    
    /**
     * Get session limit based on privacy level
     * @returns {number} - Number of sessions to keep
     */
    getSessionLimit() {
      switch (this.privacyLevel) {
        case 'minimal':
          return 1; // Only current session
        case 'moderate':
          return 5; // Last 5 sessions
        case 'full':
          return 30; // Last 30 sessions
        default:
          return 5;
      }
    }
    
    /**
     * Sanitize video data based on privacy level
     * @param {Object} videoData - Raw video data
     * @returns {Object} - Sanitized video data
     */
    sanitizeVideoData(videoData) {
      // Create a copy to avoid modifying the original
      const sanitized = { ...videoData };
      
      // Apply different sanitization based on privacy level
      switch (this.privacyLevel) {
        case 'minimal':
          // Keep only essential data
          return {
            id: sanitized.id,
            duration: sanitized.duration
          };
          
        case 'moderate':
          // Keep moderate amount of data but remove potentially sensitive fields
          delete sanitized.description;
          return sanitized;
          
        case 'full':
          // Keep all data
          return sanitized;
          
        default:
          // Default to moderate
          delete sanitized.description;
          return sanitized;
      }
    }
    
    /**
     * Sanitize event data based on privacy level
     * @param {Object} eventData - Raw event data
     * @returns {Object} - Sanitized event data
     */
    sanitizeEventData(eventData) {
      // Create a copy to avoid modifying the original
      const sanitized = { ...eventData };
      
      // Apply different sanitization based on privacy level
      switch (this.privacyLevel) {
        case 'minimal':
          // Keep only non-identifying fields
          Object.keys(sanitized).forEach(key => {
            if (['query', 'searchText', 'input', 'text'].includes(key)) {
              delete sanitized[key];
            }
          });
          return sanitized;
          
        case 'moderate':
          // Keep most data but remove potentially sensitive fields
          return sanitized;
          
        case 'full':
          // Keep all data
          return sanitized;
          
        default:
          // Default to moderate
          return sanitized;
      }
    }
    
    /**
     * Update privacy settings
     * @param {string} level - Privacy level ('minimal', 'moderate', 'full')
     * @param {boolean} enabled - Whether data collection is enabled
     * @returns {Promise} - Resolves when settings are updated
     */
    async updatePrivacySettings(level, enabled) {
      this.privacyLevel = level;
      this.collectionEnabled = enabled;
      
      return new Promise((resolve) => {
        chrome.storage.sync.set({
          privacySettings: {
            privacyLevel: level,
            collectionEnabled: enabled
          }
        }, resolve);
      });
    }
    
    /**
     * Record user consent for data collection
     * @param {boolean} consent - Whether consent is given
     * @param {string} level - Consent level
     * @returns {Promise} - Resolves when consent is recorded
     */
    async recordConsent(consent, level) {
      this.userConsent = {
        consentGiven: consent,
        consentDate: new Date().toISOString(),
        consentLevel: level
      };
      
      return new Promise((resolve) => {
        chrome.storage.sync.set({
          userConsent: this.userConsent
        }, resolve);
      });
    }
    
    /**
     * Get consent status
     * @returns {Object} - User consent status
     */
    getConsentStatus() {
      return this.userConsent;
    }
    
    /**
     * Delete all collected data
     * @returns {Promise} - Resolves when data is deleted
     */
    async deleteAllData() {
      return new Promise((resolve) => {
        chrome.storage.local.remove('agentSessionData', () => {
          this.startNewSession();
          resolve(true);
        });
      });
    }
  }
  
  // Make available to other extension components
  window.AgentDataCollector = AgentDataCollector;