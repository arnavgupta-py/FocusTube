// FocusTube - Agent Core Orchestrator
// This is the main coordinator for all agent modules

// Import agent modules
// Note: In Chrome extensions, imports work differently - we'll handle in background.js

/**
 * Main FocusTube Agent that orchestrates all sub-agents
 * and manages the overall intelligent assistant behavior
 */
class FocusTubeAgent {
    constructor() {
      // Agent system state
      this.isActive = false;
      this.userPreferences = null;
      
      // Current user context
      this.userContext = {
        sessionStartTime: null,
        currentIntent: null,
        currentActivity: null,
        currentVideoId: null,
        watchedVideos: [],
        currentSearchQuery: null
      };
      
      // Initialize specialized agents
      this.contentAgent = null;
      this.timeAgent = null;
      this.discoveryAgent = null;
      this.intentAgent = null;
      
      // Agent message log (for debugging and user transparency)
      this.activityLog = [];
    }
    
    /**
     * Initialize the agent system
     * @returns {Promise} - Resolves when initialization complete
     */
    async initialize() {
      try {
        // Log initialization
        this.logActivity('system', 'Initializing FocusTube Agent');
        
        // Load user preferences
        await this.loadUserPreferences();
        
        // Initialize sub-agents
        this.contentAgent = new ContentLearningAgent();
        await this.contentAgent.initialize();
        
        this.timeAgent = new TimeManagementAgent();
        await this.timeAgent.initialize();
        
        this.discoveryAgent = new DiscoveryAgent();
        await this.discoveryAgent.initialize();
        
        this.intentAgent = new IntentAgent();
        await this.intentAgent.initialize();
        
        // Set agent as active
        this.isActive = true;
        
        this.logActivity('system', 'FocusTube Agent initialized successfully');
        return true;
      } catch (error) {
        this.logActivity('error', `Initialization failed: ${error.message}`);
        console.error('FocusTube Agent initialization error:', error);
        return false;
      }
    }
    
    /**
     * Load user preferences from storage
     */
    async loadUserPreferences() {
      return new Promise((resolve) => {
        chrome.storage.sync.get('agentPreferences', (data) => {
          // If preferences exist, use them, otherwise create defaults
          if (data.agentPreferences) {
            this.userPreferences = data.agentPreferences;
          } else {
            // Default preferences
            this.userPreferences = {
              agentEnabled: true,
              learningMode: false,
              timeManagement: {
                enabled: true,
                dailyLimit: 60, // minutes
                productivityHours: [], // time ranges
                breakDuration: 10 // minutes
              },
              privacyLevel: 'full' // 'minimal', 'moderate', 'full'
            };
            
            // Save default preferences
            chrome.storage.sync.set({ agentPreferences: this.userPreferences });
          }
          
          resolve(this.userPreferences);
        });
      });
    }
    
    /**
     * Save current user preferences
     */
    async saveUserPreferences() {
      return new Promise((resolve) => {
        chrome.storage.sync.set({ agentPreferences: this.userPreferences }, resolve);
      });
    }
    
    /**
     * Start a new YouTube session
     * @returns {Object} - Session status and recommendations
     */
    async startSession() {
      if (!this.isActive || !this.userPreferences.agentEnabled) {
        return { canProceed: true };
      }
      
      this.userContext.sessionStartTime = Date.now();
      
      // Log session start
      this.logActivity('session', 'Starting new YouTube session');
      
      // Check time management recommendations
      if (this.userPreferences.timeManagement.enabled) {
        const timeRecommendation = await this.timeAgent.getRecommendation();
        
        if (timeRecommendation.action === 'limit') {
          this.logActivity('timeManagement', `Session limited: ${timeRecommendation.message}`);
          
          return {
            canProceed: false,
            limitReason: timeRecommendation.message,
            recommendation: {
              type: 'timeLimit',
              message: timeRecommendation.message,
              suggestedBreak: timeRecommendation.suggestedBreak || 15
            }
          };
        }
      }
      
      // Session can proceed
      return {
        canProceed: true,
        recommendation: {
          type: 'sessionStart',
          message: 'FocusTube is monitoring your session to help you stay focused.',
          timeRemaining: this.userPreferences.timeManagement.enabled ? 
            await this.timeAgent.getRemainingTime() : null
        }
      };
    }
    
    /**
     * Process a search query with agent intelligence
     * @param {string} query - Search query text
     * @returns {Promise<Object>} - Enhanced search results and recommendations
     */
    async processSearch(query) {
      if (!this.isActive || !this.userPreferences.agentEnabled) {
        // If agent is not active, return standard results
        return { useStandard: true };
      }
      
      try {
        // Update user context
        this.userContext.currentSearchQuery = query;
        this.userContext.currentActivity = 'searching';
        
        // Log search activity
        this.logActivity('search', `Processing search: "${query}"`);
        
        // Recognize user intent from query
        const recognizedIntent = await this.intentAgent.recognizeIntent(query, 'search');
        this.userContext.currentIntent = recognizedIntent;
        
        this.logActivity('intent', `Recognized intent: ${recognizedIntent}`);
        
        // Get raw search results through the API
        const searchResults = await this.fetchSearchResults(query, 50); // Get more results for filtering
        
        // Apply content learning agent to rank results
        let rankedResults = await this.contentAgent.rankSearchResults(searchResults, recognizedIntent);
        
        // If in learning mode or discovery mode, enhance with discovery recommendations
        if (recognizedIntent === 'learning' || this.userPreferences.learningMode) {
          const discoveryRecs = await this.discoveryAgent.generateExplorationRecommendations();
          rankedResults = this.injectDiscoveryRecommendations(rankedResults, discoveryRecs);
        }
        
        // Get UI configuration based on recognized intent
        const interfaceConfig = await this.intentAgent.getInterfaceConfiguration();
        
        // Prepare final results
        const finalResults = {
          useStandard: false,
          results: rankedResults.slice(0, 20), // Limit to 20 results
          intent: recognizedIntent,
          interfaceConfig: interfaceConfig,
          agentMessage: this.generateAgentMessage(recognizedIntent)
        };
        
        this.logActivity('search', `Returning ${finalResults.results.length} processed results`);
        
        return finalResults;
      } catch (error) {
        this.logActivity('error', `Search processing error: ${error.message}`);
        console.error('Search processing error:', error);
        
        // Fall back to standard search on error
        return { useStandard: true };
      }
    }
    
    /**
     * Fetch search results from YouTube API
     * @param {string} query - Search query
     * @param {number} maxResults - Maximum number of results to fetch
     * @returns {Promise<Array>} - Search results
     */
    async fetchSearchResults(query, maxResults = 20) {
      // This is just a wrapper around our existing API handler
      return new Promise((resolve, reject) => {
        try {
          // Call the YouTube API handler
          YouTubeAPI.search(query, maxResults)
            .then(resolve)
            .catch(reject);
        } catch (error) {
          reject(error);
        }
      });
    }
    
    /**
     * Inject discovery recommendations into search results
     * @param {Array} results - Ranked search results
     * @param {Object} discoveryRecs - Discovery recommendations
     * @returns {Array} - Combined results with injected recommendations
     */
    injectDiscoveryRecommendations(results, discoveryRecs) {
      // Only inject if we have gaps to fill
      if (!discoveryRecs || !discoveryRecs.gaps || discoveryRecs.gaps.length === 0) {
        return results;
      }
      
      // Clone results array to avoid modifying the original
      const combined = [...results];
      
      // Insert discovery recommendations at strategic positions
      // (e.g., position 3, 8, and 14)
      const positions = [3, 8, 14];
      
      for (let i = 0; i < Math.min(discoveryRecs.gaps.length, positions.length); i++) {
        const position = positions[i];
        const gap = discoveryRecs.gaps[i];
        
        // Only insert if we have enough results
        if (position < combined.length) {
          // Check if we have a result for this discovery topic
          const discoveryVideo = results.find(video => 
            video.title.toLowerCase().includes(gap.topic.toLowerCase()) ||
            video.description.toLowerCase().includes(gap.topic.toLowerCase())
          );
          
          if (discoveryVideo) {
            // Mark as discovery recommendation
            discoveryVideo.isDiscoveryRecommendation = true;
            discoveryVideo.discoveryReason = `Related to your interest in ${gap.relatedToKnown}`;
            
            // Move to the strategic position
            const currentIndex = combined.findIndex(v => v.id === discoveryVideo.id);
            if (currentIndex >= 0) {
              combined.splice(currentIndex, 1);
            }
            
            combined.splice(position, 0, discoveryVideo);
          }
        }
      }
      
      return combined;
    }
    
    /**
     * Generate a personalized agent message based on intent
     * @param {string} intent - Recognized user intent
     * @returns {string} - Personalized message
     */
    generateAgentMessage(intent) {
      const messages = {
        learning: "I've prioritized educational content based on your learning patterns.",
        entertainment: "I've personalized these results based on your entertainment preferences.",
        research: "These results focus on in-depth content for your research.",
        troubleshooting: "I've found the most relevant tutorials and solutions for your issue.",
        default: "Here are your personalized results."
      };
      
      return messages[intent] || messages.default;
    }
    
    /**
     * Process a video view event
     * @param {string} videoId - YouTube video ID
     * @param {Object} videoData - Video metadata
     * @returns {Object} - Video processing handlers
     */
    processVideoView(videoId, videoData) {
      if (!this.isActive || !this.userPreferences.agentEnabled) {
        return { tracking: false };
      }
      
      // Update user context
      this.userContext.currentVideoId = videoId;
      this.userContext.currentActivity = 'watching';
      this.userContext.watchedVideos.push(videoId);
      
      // Record video start time
      const startTime = Date.now();
      
      // Log video start
      this.logActivity('video', `Started watching: ${videoData.title} (${videoId})`);
      
      // Update discovery graph with this video's content
      this.discoveryAgent.processVideoContent(videoData);
      
      // Return handlers for video events
      return {
        tracking: true,
        
        // Handler for when video ends or user leaves
        videoEnded: async (watchDuration) => {
          try {
            // Calculate engagement metrics
            const durationSeconds = videoData.duration ? this.parseIsoDuration(videoData.duration) : 0;
            const engagementRatio = durationSeconds > 0 ? (watchDuration / 1000) / durationSeconds : 0;
            
            this.logActivity('video', `Finished watching: ${videoId}, watched ${Math.round(watchDuration/1000)}s, engagement: ${Math.round(engagementRatio * 100)}%`);
            
            // Record positive or negative engagement
            if (engagementRatio > 0.7) {
              await this.contentAgent.recordPositiveEngagement(videoId, videoData);
              this.logActivity('engagement', `Positive engagement recorded: ${videoId}`);
            } else if (engagementRatio < 0.3 && watchDuration > 30000) {
              await this.contentAgent.recordNegativeEngagement(videoId, videoData, watchDuration);
              this.logActivity('engagement', `Negative engagement recorded: ${videoId}`);
            }
            
            // Update time tracking
            await this.timeAgent.trackSession(startTime, Date.now(), [videoId]);
            
            // Generate "what to watch next" recommendations
            return await this.generateNextRecommendations();
          } catch (error) {
            this.logActivity('error', `Video end processing error: ${error.message}`);
            console.error('Video end processing error:', error);
            return { type: 'standard' };
          }
        }
      };
    }
    
    /**
     * Generate recommendations for what to watch next
     * @returns {Promise<Object>} - Next watch recommendations
     */
    async generateNextRecommendations() {
      try {
        // Check time management first
        if (this.userPreferences.timeManagement.enabled) {
          const timeRecommendation = await this.timeAgent.getRecommendation();
          
          // If should take a break, recommend that
          if (timeRecommendation.action === 'limit') {
            return {
              type: 'break',
              message: timeRecommendation.message,
              duration: this.userPreferences.timeManagement.breakDuration
            };
          }
        }
        
        // Otherwise, recommend content based on recognized intent
        switch (this.userContext.currentIntent) {
          case 'learning':
            const learningSteps = await this.discoveryAgent.getNextLearningSteps();
            return {
              type: 'learning-path',
              message: "To continue your learning journey, I recommend these related topics:",
              recommendations: learningSteps
            };
            
          case 'research':
            const relatedContent = await this.discoveryAgent.getRelatedContent();
            return {
              type: 'related-content',
              message: "Based on your research focus, you might find these videos valuable:",
              recommendations: relatedContent
            };
            
          default:
            const timeRemaining = this.userPreferences.timeManagement.enabled ? 
              await this.timeAgent.getRemainingTime() : null;
              
            return {
              type: 'standard',
              message: timeRemaining ? 
                `You have about ${Math.round(timeRemaining)} minutes of YouTube time remaining today.` : 
                "Here are some recommendations based on your viewing patterns:"
            };
        }
      } catch (error) {
        this.logActivity('error', `Recommendation generation error: ${error.message}`);
        console.error('Recommendation generation error:', error);
        return { type: 'standard' };
      }
    }
    
    /**
     * Parse ISO 8601 duration format to seconds
     * @param {string} isoDuration - ISO 8601 duration string (e.g., "PT1H30M15S")
     * @returns {number} - Duration in seconds
     */
    parseIsoDuration(isoDuration) {
      const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
      const match = isoDuration.match(regex);
      
      if (!match) return 0;
      
      const hours = parseInt(match[1] || 0);
      const minutes = parseInt(match[2] || 0);
      const seconds = parseInt(match[3] || 0);
      
      return hours * 3600 + minutes * 60 + seconds;
    }
    
    /**
     * Log agent activity for debugging and transparency
     * @param {string} type - Activity type
     * @param {string} message - Activity message
     */
    logActivity(type, message) {
      const entry = {
        timestamp: new Date().toISOString(),
        type,
        message
      };
      
      // Add to in-memory log
      this.activityLog.push(entry);
      
      // Limit log size
      if (this.activityLog.length > 1000) {
        this.activityLog.shift();
      }
      
      // Log to console in debug mode
      console.log(`[FocusTube ${type}] ${message}`);
      
      // Could also save logs to storage if needed for transparency
      // and user review of agent actions
    }
    
    /**
     * Reset all agent learning and data
     * This provides users with privacy control
     */
    async resetAgentData() {
      try {
        this.logActivity('privacy', 'Resetting all agent data');
        
        // Reset all sub-agents
        await this.contentAgent.resetData();
        await this.timeAgent.resetData();
        await this.discoveryAgent.resetData();
        await this.intentAgent.resetData();
        
        // Clear activity log
        this.activityLog = [];
        
        // Maintain preferences but reset learned data
        await this.saveUserPreferences();
        
        return true;
      } catch (error) {
        this.logActivity('error', `Data reset error: ${error.message}`);
        console.error('Data reset error:', error);
        return false;
      }
    }
  }
  
  // Make available to other extension components
  window.FocusTubeAgent = FocusTubeAgent;