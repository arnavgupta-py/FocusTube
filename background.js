// FocusTube Extension - Background Script with Complete Agent System

// ========================================================
// AGENT SYSTEM IMPLEMENTATION
// ========================================================

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
    this.contentAgent = new ContentLearningAgent();
    this.timeAgent = new TimeManagementAgent();
    this.discoveryAgent = new DiscoveryAgent();
    this.intentAgent = new IntentAgent();
    this.dataCollector = new AgentDataCollector();
    
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
      await this.contentAgent.initialize();
      await this.timeAgent.initialize();
      await this.discoveryAgent.initialize();
      await this.intentAgent.initialize();
      await this.dataCollector.initialize();
      
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
        if (typeof YouTubeAPI !== 'undefined' && YouTubeAPI.search) {
          YouTubeAPI.search(query, maxResults)
            .then(resolve)
            .catch(reject);
        } else {
          // If API handler not available, return mock data
          resolve(this.getMockSearchResults(query, maxResults));
        }
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Generate mock search results when API is unavailable
   * @param {string} query - Search query
   * @param {number} maxResults - Desired number of results
   * @returns {Array} - Mock search results
   */
  getMockSearchResults(query, maxResults) {
    const results = [];
    for (let i = 1; i <= maxResults; i++) {
      results.push({
        id: `mockid${i}`,
        title: `${query} - Result ${i}`,
        description: `This is a mock search result for "${query}"`,
        thumbnail: `https://via.placeholder.com/480x360.png?text=Result+${i}`,
        channelTitle: 'Mock Channel',
        publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
        viewCount: Math.floor(Math.random() * 1000000),
        duration: 'PT' + Math.floor(Math.random() * 10) + 'M' + Math.floor(Math.random() * 60) + 'S'
      });
    }
    return results;
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
    this.logActivity('video', `Started watching: ${videoData.title || videoId}`);
    
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

/**
 * Agent that learns about content preferences from user engagement
 * and applies this knowledge to rank search results
 */
class ContentLearningAgent {
  constructor() {
    // Store user engagement with different videos
    this.videoEngagementHistory = {};
    
    // Content preference model for different attributes
    this.contentPreferenceModel = {
      topics: {},       // Topic preference scores
      channels: {},     // Channel preference scores
      formats: {},      // Format preference scores (e.g., tutorial, lecture)
      durations: {      // Duration preference scores
        short: 0,       // < 5 minutes
        medium: 0,      // 5-20 minutes
        long: 0,        // 20-60 minutes
        extended: 0     // > 60 minutes
      }
    };
    
    // Metadata extraction patterns
    this.topicKeywordPatterns = [
      /\b(javascript|python|react|ai|machine learning|data science)\b/gi,
      /\b(history|science|math|literature|philosophy)\b/gi,
      /\b(tutorial|guide|introduction|beginner|advanced)\b/gi
    ];
  }
  
  /**
   * Initialize the content agent
   * @returns {Promise} - Resolves when initialization is complete
   */
  async initialize() {
    return new Promise((resolve) => {
      // Load previous engagement history and preference model from storage
      chrome.storage.local.get(['videoEngagementHistory', 'contentPreferenceModel'], (data) => {
        if (data.videoEngagementHistory) {
          this.videoEngagementHistory = data.videoEngagementHistory;
        }
        
        if (data.contentPreferenceModel) {
          this.contentPreferenceModel = data.contentPreferenceModel;
        }
        
        resolve(true);
      });
    });
  }
  
  /**
   * Record positive engagement with a video
   * @param {string} videoId - YouTube video ID
   * @param {Object} metadata - Video metadata
   * @returns {Promise} - Resolves when update is complete
   */
  async recordPositiveEngagement(videoId, metadata) {
    // Update engagement history
    if (!this.videoEngagementHistory[videoId]) {
      this.videoEngagementHistory[videoId] = {
        positive: 0,
        negative: 0,
        metadata: this.extractMetadata(metadata),
        lastWatched: Date.now()
      };
    }
    
    this.videoEngagementHistory[videoId].positive += 1;
    this.videoEngagementHistory[videoId].lastWatched = Date.now();
    
    // Update content preference model
    await this.updateContentModel();
    
    // Save updated data
    return this.saveData();
  }
  
  /**
   * Record negative engagement with a video
   * @param {string} videoId - YouTube video ID
   * @param {Object} metadata - Video metadata
   * @param {number} watchTime - Watch time in milliseconds
   * @returns {Promise} - Resolves when update is complete
   */
  async recordNegativeEngagement(videoId, metadata, watchTime) {
    // Update engagement history
    if (!this.videoEngagementHistory[videoId]) {
      this.videoEngagementHistory[videoId] = {
        positive: 0,
        negative: 0,
        metadata: this.extractMetadata(metadata),
        lastWatched: Date.now()
      };
    }
    
    this.videoEngagementHistory[videoId].negative += 1;
    this.videoEngagementHistory[videoId].lastWatched = Date.now();
    this.videoEngagementHistory[videoId].abandonTime = watchTime;
    
    // Update content preference model
    await this.updateContentModel();
    
    // Save updated data
    return this.saveData();
  }
  
  /**
   * Extract structured metadata from video data
   * @param {Object} videoData - Raw video data
   * @returns {Object} - Structured metadata
   */
  extractMetadata(videoData) {
    // Default values in case videoData is incomplete
    const videoTitle = videoData.title || '';
    const videoDescription = videoData.description || '';
    const channelId = videoData.channelId || 'unknown';
    const channelTitle = videoData.channelTitle || 'Unknown Channel';
    const publishedAt = videoData.publishedAt || new Date().toISOString();
    const viewCount = videoData.viewCount || 0;
    
    // Extract duration category
    let durationCategory = 'unknown';
    if (videoData.duration) {
      const durationSeconds = this.parseIsoDuration(videoData.duration);
      
      if (durationSeconds < 300) {
        durationCategory = 'short';
      } else if (durationSeconds < 1200) {
        durationCategory = 'medium';
      } else if (durationSeconds < 3600) {
        durationCategory = 'long';
      } else {
        durationCategory = 'extended';
      }
    }
    
    // Extract topics from title and description
    const combinedText = `${videoTitle} ${videoDescription}`.toLowerCase();
    const topics = new Set();
    
    this.topicKeywordPatterns.forEach(pattern => {
      const matches = combinedText.match(pattern);
      if (matches) {
        matches.forEach(match => topics.add(match.toLowerCase()));
      }
    });
    
    // Detect video format based on title patterns
    const formatPatterns = {
      tutorial: /(tutorial|how to|learn|guide)/i,
      review: /(review|comparison|vs\.)/i,
      lecture: /(lecture|lesson|class|course)/i,
      entertainment: /(funny|comedy|prank|reaction)/i,
      news: /(news|update|latest|report)/i
    };
    
    const formats = [];
    for (const [format, pattern] of Object.entries(formatPatterns)) {
      if (pattern.test(videoTitle)) {
        formats.push(format);
      }
    }
    
    return {
      channelId,
      channelTitle,
      durationCategory,
      topics: Array.from(topics),
      formats: formats.length > 0 ? formats : ['uncategorized'],
      publishedAt,
      viewCount
    };
  }
  
  /**
   * Update the content preference model based on engagement history
   * @returns {Promise} - Resolves when update is complete
   */
  async updateContentModel() {
    // Reset model scores (but keep the keys)
    for (const topic in this.contentPreferenceModel.topics) {
      this.contentPreferenceModel.topics[topic] = 0;
    }
    
    for (const channel in this.contentPreferenceModel.channels) {
      this.contentPreferenceModel.channels[channel] = 0;
    }
    
    for (const format in this.contentPreferenceModel.formats) {
      this.contentPreferenceModel.formats[format] = 0;
    }
    
    for (const duration in this.contentPreferenceModel.durations) {
      this.contentPreferenceModel.durations[duration] = 0;
    }
    
    // Calculate scores based on engagement history
    const now = Date.now();
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);
    
    // Process each video in engagement history
    for (const [videoId, engagement] of Object.entries(this.videoEngagementHistory)) {
      // Skip old data
      if (engagement.lastWatched < oneMonthAgo) continue;
      
      // Calculate engagement score (positive minus negative, with recency factor)
      const recencyFactor = Math.max(0.1, Math.min(1, 1 - (now - engagement.lastWatched) / (30 * 24 * 60 * 60 * 1000)));
      const engagementScore = (engagement.positive - engagement.negative * 0.5) * recencyFactor;
      
      // Skip videos with negative overall engagement
      if (engagementScore <= 0) continue;
      
      const metadata = engagement.metadata;
      if (!metadata) continue;
      
      // Update channel scores
      if (metadata.channelId) {
        if (!this.contentPreferenceModel.channels[metadata.channelId]) {
          this.contentPreferenceModel.channels[metadata.channelId] = 0;
        }
        this.contentPreferenceModel.channels[metadata.channelId] += engagementScore;
      }
      
      // Update topic scores
      if (metadata.topics && metadata.topics.length > 0) {
        metadata.topics.forEach(topic => {
          if (!this.contentPreferenceModel.topics[topic]) {
            this.contentPreferenceModel.topics[topic] = 0;
          }
          this.contentPreferenceModel.topics[topic] += engagementScore;
        });
      }
      
      // Update format scores
      if (metadata.formats && metadata.formats.length > 0) {
        metadata.formats.forEach(format => {
          if (!this.contentPreferenceModel.formats[format]) {
            this.contentPreferenceModel.formats[format] = 0;
          }
          this.contentPreferenceModel.formats[format] += engagementScore;
        });
      }
      
      // Update duration preference
      if (metadata.durationCategory) {
        this.contentPreferenceModel.durations[metadata.durationCategory] += engagementScore;
      }
    }
    
    // Normalize scores to a 0-100 scale for each category
    this.normalizeModelScores();
    
    return true;
  }
  
  /**
   * Normalize preference model scores to 0-100 scale
   */
  normalizeModelScores() {
    // Normalize each category separately
    this.normalizeCategory(this.contentPreferenceModel.topics);
    this.normalizeCategory(this.contentPreferenceModel.channels);
    this.normalizeCategory(this.contentPreferenceModel.formats);
    this.normalizeCategory(this.contentPreferenceModel.durations);
  }
  
  /**
   * Normalize scores in a category to 0-100 scale
   * @param {Object} category - Category object with scores
   */
  normalizeCategory(category) {
    // Find maximum score
    let maxScore = 0.1; // Small epsilon to avoid division by zero
    
    for (const key in category) {
      if (category[key] > maxScore) {
        maxScore = category[key];
      }
    }
    
    // Normalize scores
    for (const key in category) {
      category[key] = Math.round((category[key] / maxScore) * 100);
    }
  }
  
  /**
   * Rank search results based on learned preferences
   * @param {Array} results - Search results to rank
   * @param {string} userIntent - Recognized user intent
   * @returns {Promise<Array>} - Ranked search results
   */
  async rankSearchResults(results, userIntent) {
    // If no results or empty preference model, return original order
    if (!results || results.length === 0 || Object.keys(this.contentPreferenceModel.topics).length === 0) {
      return results;
    }
    
    // Extract metadata for each result
    const resultsWithMetadata = results.map(result => {
      return {
        ...result,
        extractedMetadata: this.extractMetadata(result),
        relevanceScore: 0
      };
    });
    
    // Calculate relevance score for each result
    resultsWithMetadata.forEach(result => {
      let score = 0;
      const metadata = result.extractedMetadata;
      
      // Add channel preference score (weight: 30%)
      if (metadata.channelId && this.contentPreferenceModel.channels[metadata.channelId]) {
        score += this.contentPreferenceModel.channels[metadata.channelId] * 0.3;
      }
      
      // Add topic preference score (weight: 40%)
      if (metadata.topics && metadata.topics.length > 0) {
        let topicScore = 0;
        metadata.topics.forEach(topic => {
          if (this.contentPreferenceModel.topics[topic]) {
            topicScore += this.contentPreferenceModel.topics[topic];
          }
        });
        score += (topicScore / metadata.topics.length) * 0.4;
      }
      
      // Add format preference score (weight: 20%)
      if (metadata.formats && metadata.formats.length > 0) {
        let formatScore = 0;
        metadata.formats.forEach(format => {
          if (this.contentPreferenceModel.formats[format]) {
            formatScore += this.contentPreferenceModel.formats[format];
          }
        });
        score += (formatScore / metadata.formats.length) * 0.2;
      }
      
      // Add duration preference score (weight: 10%)
      if (metadata.durationCategory && this.contentPreferenceModel.durations[metadata.durationCategory]) {
        score += this.contentPreferenceModel.durations[metadata.durationCategory] * 0.1;
      }
      
      // Adjust score based on user intent
      if (userIntent === 'learning' && 
          (metadata.formats.includes('tutorial') || metadata.formats.includes('lecture'))) {
        score *= 1.2; // Boost educational content for learning intent
      } else if (userIntent === 'entertainment' && 
                metadata.formats.includes('entertainment')) {
        score *= 1.2; // Boost entertainment for entertainment intent
      }
      
      // Store the calculated score
      result.relevanceScore = score;
    });
    
    // Sort by relevance score (descending)
    const sortedResults = [...resultsWithMetadata].sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Return ranked results (without the added metadata and scores)
    return sortedResults.map(result => {
      const { extractedMetadata, relevanceScore, ...cleanResult } = result;
      return cleanResult;
    });
  }
  
  /**
   * Parse ISO 8601 duration to seconds
   * @param {string} isoDuration - ISO 8601 duration string
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
   * Save agent data to storage
   * @returns {Promise} - Resolves when data is saved
   */
  async saveData() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        videoEngagementHistory: this.videoEngagementHistory,
        contentPreferenceModel: this.contentPreferenceModel
      }, resolve);
    });
  }
  
  /**
   * Reset all agent data
   * @returns {Promise} - Resolves when data is reset
   */
  async resetData() {
    this.videoEngagementHistory = {};
    this.contentPreferenceModel = {
      topics: {},
      channels: {},
      formats: {},
      durations: {
        short: 0,
        medium: 0,
        long: 0,
        extended: 0
      }
    };
    
    return this.saveData();
  }
}

/**
 * Agent that monitors and manages YouTube usage time
 * to prevent excessive consumption and encourage healthy habits
 */
class TimeManagementAgent {
  constructor() {
    // User's usage patterns
    this.usagePatterns = {
      dailyUsage: [],      // Array of daily usage records
      weeklyAverage: 0,    // Weekly average in minutes
      productiveHours: [], // Hours when user is typically productive
      problematicPeriods: [] // Time periods with excessive usage
    };
    
    // Default time goals
    this.timeGoals = {
      dailyLimit: 60,      // Daily limit in minutes
      weeklyLimit: 300,    // Weekly limit in minutes
      productivityHours: [],  // Time ranges to restrict YouTube
      breakDuration: 10    // Recommended break duration in minutes
    };
  }
  
  /**
   * Initialize the time management agent
   * @returns {Promise} - Resolves when initialization is complete
   */
  async initialize() {
    return new Promise((resolve) => {
      // Load previous usage patterns and time goals
      chrome.storage.local.get(['usagePatterns', 'timeGoals'], (data) => {
        if (data.usagePatterns) {
          this.usagePatterns = data.usagePatterns;
        }
        
        if (data.timeGoals) {
          this.timeGoals = data.timeGoals;
        }
        
        // Update weekly average
        this.updateWeeklyAverage();
        
        resolve(true);
      });
    });
  }
  
  /**
   * Track a YouTube session
   * @param {number} startTime - Session start timestamp
   * @param {number} endTime - Session end timestamp
   * @param {Array} videoIds - Array of watched video IDs
   * @returns {Promise} - Resolves when tracking is complete
   */
  async trackSession(startTime, endTime, videoIds) {
    // Calculate session duration in minutes
    const sessionDuration = (endTime - startTime) / 60000;
    
    // Skip tracking very short sessions (less than 10 seconds)
    if (sessionDuration < 0.17) {
      return true;
    }
    
    // Get today's date in YYYY-MM-DD format
    const date = new Date(startTime);
    const dateString = date.toISOString().split('T')[0];
    
    // Get day and hour information
    const dayOfWeek = date.getDay();
    const hourOfDay = date.getHours();
    
    // Check if we already have a record for today
    const todayIndex = this.usagePatterns.dailyUsage.findIndex(
      record => record.date === dateString
    );
    
    if (todayIndex >= 0) {
      // Update existing record
      this.usagePatterns.dailyUsage[todayIndex].duration += sessionDuration;
      this.usagePatterns.dailyUsage[todayIndex].sessions.push({
        startTime,
        endTime,
        duration: sessionDuration,
        videos: videoIds
      });
    } else {
      // Create new record for today
      this.usagePatterns.dailyUsage.push({
        date: dateString,
        dayOfWeek,
        duration: sessionDuration,
        sessions: [{
          startTime,
          endTime,
          duration: sessionDuration,
          videos: videoIds
        }]
      });
    }
    
    // Keep only the last 28 days of usage data
    if (this.usagePatterns.dailyUsage.length > 28) {
      this.usagePatterns.dailyUsage.sort((a, b) => new Date(b.date) - new Date(a.date));
      this.usagePatterns.dailyUsage = this.usagePatterns.dailyUsage.slice(0, 28);
    }
    
    // Update weekly average
    this.updateWeeklyAverage();
    
    // Analyze productive hours (when user uses YouTube less)
    this.analyzeProductiveHours();
    
    // Analyze problematic periods (when user uses YouTube excessively)
    this.analyzeProblematicPeriods();
    
    // Save updated patterns
    return this.saveData();
  }
  
  /**
   * Update the weekly average usage
   */
  updateWeeklyAverage() {
    const now = new Date();
    let totalMinutes = 0;
    let daysCounted = 0;
    
    // Calculate total for the last 7 days
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() - i);
      const targetDateString = targetDate.toISOString().split('T')[0];
      
      const dayRecord = this.usagePatterns.dailyUsage.find(
        record => record.date === targetDateString
      );
      
      if (dayRecord) {
        totalMinutes += dayRecord.duration;
        daysCounted++;
      }
    }
    
    // Calculate average (if we have data)
    if (daysCounted > 0) {
      this.usagePatterns.weeklyAverage = totalMinutes / daysCounted * 7;
    } else {
      this.usagePatterns.weeklyAverage = 0;
    }
  }
  
  /**
   * Analyze when the user tends to be productive (uses YouTube less)
   */
  analyzeProductiveHours() {
    // Count usage by hour of day
    const hourCounts = Array(24).fill(0);
    const hourTotalMinutes = Array(24).fill(0);
    
    // Gather data from all sessions
    this.usagePatterns.dailyUsage.forEach(day => {
      day.sessions.forEach(session => {
        const startHour = new Date(session.startTime).getHours();
        hourCounts[startHour]++;
        hourTotalMinutes[startHour] += session.duration;
      });
    });
    
    // Calculate average usage per hour
    const hourlyAverages = hourTotalMinutes.map((total, index) => ({
      hour: index,
      average: hourCounts[index] > 0 ? total / hourCounts[index] : 0
    }));
    
    // Find hours with significantly lower usage
    // (potential productive hours where YouTube should be limited)
    const overallAverage = hourlyAverages.reduce((sum, hour) => sum + hour.average, 0) / 24;
    
    this.usagePatterns.productiveHours = hourlyAverages
      .filter(hour => hour.average < overallAverage * 0.5 && hour.average > 0)
      .map(hour => hour.hour);
    
    // Business hours (9-5) are likely productive if we don't have enough data
    if (this.usagePatterns.productiveHours.length < 3) {
      for (let hour = 9; hour <= 17; hour++) {
        if (!this.usagePatterns.productiveHours.includes(hour)) {
          this.usagePatterns.productiveHours.push(hour);
        }
      }
    }
  }
  
  /**
   * Analyze when the user tends to use YouTube excessively
   */
  analyzeProblematicPeriods() {
    // A period is problematic if:
    // 1. User regularly exceeds daily limit
    // 2. Sessions are longer than average
    
    // Analyze by day of week
    const dayStats = Array(7).fill().map(() => ({
      totalMinutes: 0,
      dayCount: 0,
      longSessions: 0
    }));
    
    // Calculate average session length
    let totalSessionLength = 0;
    let sessionCount = 0;
    
    this.usagePatterns.dailyUsage.forEach(day => {
      const dayOfWeek = new Date(day.date).getDay();
      
      dayStats[dayOfWeek].totalMinutes += day.duration;
      dayStats[dayOfWeek].dayCount++;
      
      day.sessions.forEach(session => {
        totalSessionLength += session.duration;
        sessionCount++;
        
        // Count long sessions (over 30 minutes)
        if (session.duration > 30) {
          dayStats[dayOfWeek].longSessions++;
        }
      });
    });
    
    const averageSessionLength = sessionCount > 0 ? totalSessionLength / sessionCount : 0;
    
    // Identify problematic days
    this.usagePatterns.problematicPeriods = [];
    
    dayStats.forEach((stats, day) => {
      if (stats.dayCount > 0) {
        const dailyAverage = stats.totalMinutes / stats.dayCount;
        
        // If average usage on this day exceeds limit by 25%
        if (dailyAverage > this.timeGoals.dailyLimit * 1.25) {
          this.usagePatterns.problematicPeriods.push({
            type: 'day',
            day,
            averageUsage: dailyAverage,
            excessPercentage: (dailyAverage / this.timeGoals.dailyLimit) * 100 - 100
          });
        }
        
        // If this day has significantly more long sessions than average
        if (stats.longSessions > stats.dayCount * 0.5) {
          if (!this.usagePatterns.problematicPeriods.find(p => p.type === 'day' && p.day === day)) {
            this.usagePatterns.problematicPeriods.push({
              type: 'day',
              day,
              longSessions: stats.longSessions,
              totalDays: stats.dayCount
            });
          }
        }
      }
    });
  }
  
  /**
   * Get time management recommendation
   * @returns {Promise<Object>} - Time management recommendation
   */
  async getRecommendation() {
    // Get today's usage
    const todayUsage = await this.getTodayUsage();
    const now = new Date();
    const currentHour = now.getHours();
    
    // Default recommendation (allow usage)
    let recommendation = {
      action: 'allow',
      message: `You've watched ${Math.round(todayUsage)} minutes of YouTube today.`
    };
    
    // Check if in productivity hours
    const inProductiveHours = this.timeGoals.productivityHours.includes(currentHour) ||
                             this.usagePatterns.productiveHours.includes(currentHour);
    
    if (inProductiveHours) {
      recommendation = {
        action: 'limit',
        message: `This is typically a productive time for you. Consider using YouTube later.`,
        suggestedBreak: 60
      };
    }
    
    // Check if daily limit exceeded
    if (todayUsage >= this.timeGoals.dailyLimit) {
      recommendation = {
        action: 'limit',
        message: `You've reached your daily limit of ${this.timeGoals.dailyLimit} minutes.`,
        suggestedBreak: 120 // Suggest longer break
      };
    }
    
    // Check if weekly limit exceeded
    const currentWeekUsage = await this.getCurrentWeekUsage();
    if (currentWeekUsage >= this.timeGoals.weeklyLimit) {
      recommendation = {
        action: 'limit',
        message: `You've reached your weekly limit of ${this.timeGoals.weeklyLimit} minutes.`,
        suggestedBreak: 180 // Suggest even longer break
      };
    }
    
    return recommendation;
  }
  
  /**
   * Get today's YouTube usage in minutes
   * @returns {Promise<number>} - Usage in minutes
   */
  async getTodayUsage() {
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = this.usagePatterns.dailyUsage.find(record => record.date === today);
    
    return todayRecord ? todayRecord.duration : 0;
  }
  
  /**
   * Get current week's YouTube usage in minutes
   * @returns {Promise<number>} - Usage in minutes
   */
  async getCurrentWeekUsage() {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Set to Sunday
    startOfWeek.setHours(0, 0, 0, 0);
    
    let totalMinutes = 0;
    
    // Sum usage for days in current week
    this.usagePatterns.dailyUsage.forEach(record => {
      const recordDate = new Date(record.date);
      if (recordDate >= startOfWeek) {
        totalMinutes += record.duration;
      }
    });
    
    return totalMinutes;
  }
  
  /**
   * Get remaining YouTube time for today
   * @returns {Promise<number>} - Remaining minutes
   */
  async getRemainingTime() {
    const todayUsage = await this.getTodayUsage();
    return Math.max(0, this.timeGoals.dailyLimit - todayUsage);
  }
  
  /**
   * Save agent data to storage
   * @returns {Promise} - Resolves when data is saved
   */
  async saveData() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        usagePatterns: this.usagePatterns,
        timeGoals: this.timeGoals
      }, resolve);
    });
  }
  
  /**
   * Reset all agent data
   * @returns {Promise} - Resolves when data is reset
   */
  async resetData() {
    this.usagePatterns = {
      dailyUsage: [],
      weeklyAverage: 0,
      productiveHours: [],
      problematicPeriods: []
    };
    
    // Keep time goals but reset usage data
    return this.saveData();
  }
}

/**
 * Agent that builds a knowledge graph of topics based on user's 
 * viewing history and suggests content to expand their understanding
 */
class DiscoveryAgent {
  constructor() {
    // User's topic exploration graph
    this.topicGraph = {
      nodes: {}, // Topics as nodes
      edges: {}  // Relationships between topics
    };
    
    // Current learning paths (sequences of related topics)
    this.learningPaths = [];
    
    // Topic keywords and extraction patterns
    this.topicKeywords = [
      // Tech topics
      'javascript', 'python', 'react', 'machine learning', 'ai', 'programming',
      'data science', 'algorithms', 'blockchain', 'web development',
      
      // Academic subjects
      'physics', 'biology', 'chemistry', 'history', 'mathematics', 'literature',
      'philosophy', 'psychology', 'economics', 'sociology',
      
      // Skills
      'cooking', 'photography', 'gardening', 'drawing', 'painting', 'writing',
      'public speaking', 'meditation', 'fitness', 'language learning',
      
      // Content types
      'tutorial', 'lecture', 'review', 'explanation', 'guide', 'introduction',
      'advanced', 'beginner', 'masterclass', 'case study'
    ];
    
    // Text processing utilities
    this.stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'with', 'by', 'about', 'as', 'of', 'from', 'how', 'what', 'why', 'when',
      'where', 'who', 'which', 'this', 'that', 'these', 'those', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
      'did', 'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must'
    ]);
  }
  
  /**
   * Initialize the discovery agent
   * @returns {Promise} - Resolves when initialization is complete
   */
  async initialize() {
    return new Promise((resolve) => {
      // Load previous topic graph and learning paths
      chrome.storage.local.get(['topicGraph', 'learningPaths'], (data) => {
        if (data.topicGraph) {
          this.topicGraph = data.topicGraph;
        }
        
        if (data.learningPaths) {
          this.learningPaths = data.learningPaths;
        }
        
        resolve(true);
      });
    });
  }
  
  /**
   * Process a video's content to update the topic graph
   * @param {Object} videoData - Video metadata
   * @returns {Promise} - Resolves when processing is complete
   */
  async processVideoContent(videoData) {
    try {
      // Extract topics from video data
      const videoTopics = this.extractTopics(videoData);
      
      if (videoTopics.length === 0) {
        return true; // No topics found
      }
      
      // Update topic nodes
      videoTopics.forEach(topic => {
        if (!this.topicGraph.nodes[topic]) {
          // Create new topic node
          this.topicGraph.nodes[topic] = {
            engagementCount: 1,
            lastViewed: new Date().toISOString(),
            relatedVideos: [videoData.id || ''],
            title: topic
          };
        } else {
          // Update existing topic
          this.topicGraph.nodes[topic].engagementCount += 1;
          this.topicGraph.nodes[topic].lastViewed = new Date().toISOString();
          
          // Add video ID if not already in list and it exists
          if (videoData.id && !this.topicGraph.nodes[topic].relatedVideos.includes(videoData.id)) {
            this.topicGraph.nodes[topic].relatedVideos.push(videoData.id);
            
            // Limit to most recent 10 videos
            if (this.topicGraph.nodes[topic].relatedVideos.length > 10) {
              this.topicGraph.nodes[topic].relatedVideos.shift();
            }
          }
        }
      });
      
      // Create edges between co-occurring topics
      for (let i = 0; i < videoTopics.length; i++) {
        for (let j = i + 1; j < videoTopics.length; j++) {
          const topicPair = [videoTopics[i], videoTopics[j]].sort().join('|');
          
          if (!this.topicGraph.edges[topicPair]) {
            this.topicGraph.edges[topicPair] = {
              count: 1,
              lastObserved: new Date().toISOString()
            };
          } else {
            this.topicGraph.edges[topicPair].count += 1;
            this.topicGraph.edges[topicPair].lastObserved = new Date().toISOString();
          }
        }
      }
      
      // Update learning paths
      await this.updateLearningPaths(videoTopics);
      
      // Save updated graph
      return this.saveData();
    } catch (error) {
      console.error('Error processing video content:', error);
      return false;
    }
  }
  
  /**
   * Extract topics from video data
   * @param {Object} videoData - Video metadata
   * @returns {Array} - Array of topic strings
   */
  extractTopics(videoData) {
    const topics = new Set();
    
    // Ensure videoData properties exist
    const videoTitle = videoData.title || '';
    const videoDescription = videoData.description || '';
    
    // Combine title and description
    const text = `${videoTitle} ${videoDescription}`.toLowerCase();
    
    // Extract known topics
    this.topicKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        topics.add(keyword);
      }
    });
    
    // Extract noun phrases (potential new topics)
    const words = text.split(/\s+/);
    const phrases = this.extractNounPhrases(words);
    
    phrases.forEach(phrase => {
      // Only add meaningful phrases (2+ words, not just stopwords)
      if (phrase.split(' ').length >= 2 && 
          !phrase.split(' ').every(word => this.stopWords.has(word))) {
        topics.add(phrase);
      }
    });
    
    return Array.from(topics);
  }
  
  /**
   * Extract potential noun phrases from text
   * @param {Array} words - Array of words
   * @returns {Array} - Potential noun phrases
   */
  extractNounPhrases(words) {
    const phrases = [];
    let currentPhrase = [];
    
    // Very simple noun phrase extraction
    // (This could be improved with NLP techniques)
    words.forEach(word => {
      // Skip stop words at the beginning of phrases
      if (currentPhrase.length === 0 && this.stopWords.has(word)) {
        return;
      }
      
      // End phrase on punctuation or certain words
      if (/[,.?!;:]/.test(word) || 
          ['and', 'or', 'but', 'because', 'however'].includes(word)) {
        if (currentPhrase.length > 0) {
          phrases.push(currentPhrase.join(' '));
          currentPhrase = [];
        }
        return;
      }
      
      // Add word to current phrase
      currentPhrase.push(word);
      
      // If phrase gets too long, save it and start a new one
      if (currentPhrase.length >= 4) {
        phrases.push(currentPhrase.join(' '));
        
        // Slide the window (overlap phrases)
        currentPhrase = currentPhrase.slice(2);
      }
    });
    
    // Add any remaining phrase
    if (currentPhrase.length > 0) {
      phrases.push(currentPhrase.join(' '));
    }
    
    return phrases;
  }
  
  /**
   * Update learning paths based on new topics
   * @param {Array} videoTopics - Topics from current video
   * @returns {Promise} - Resolves when update is complete
   */
  async updateLearningPaths(videoTopics) {
    // Identify potential path connections
    const existingPaths = [...this.learningPaths];
    
    existingPaths.forEach(path => {
      // Check if current video connects to this path
      const lastTopic = path.topics[path.topics.length - 1];
      
      videoTopics.forEach(topic => {
        // Don't add topic if already in the path
        if (path.topics.includes(topic)) {
          return;
        }
        
        // Check if topics are connected in the graph
        const topicPair = [lastTopic, topic].sort().join('|');
        
        if (this.topicGraph.edges[topicPair] && 
            this.topicGraph.edges[topicPair].count >= 2) {
          // Found a potential continuation of this path
          path.topics.push(topic);
          path.lastUpdated = new Date().toISOString();
          
          // Limit path length
          if (path.topics.length > 8) {
            path.topics.shift();
          }
        }
      });
    });
    
    // Start new paths from multi-topic videos
    if (videoTopics.length >= 2) {
      const pathExists = existingPaths.some(path => 
        videoTopics.every(topic => path.topics.includes(topic))
      );
      
      if (!pathExists) {
        this.learningPaths.push({
          id: `path_${Date.now()}`,
          topics: [...videoTopics],
          created: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        });
      }
    }
    
    // Keep only active paths (updated in the last 2 weeks)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    
    this.learningPaths = this.learningPaths.filter(path => 
      new Date(path.lastUpdated) >= twoWeeksAgo
    );
    
    // Limit total number of paths
    if (this.learningPaths.length > 10) {
      // Sort by last updated (most recent first)
      this.learningPaths.sort((a, b) => 
        new Date(b.lastUpdated) - new Date(a.lastUpdated)
      );
      
      // Keep only the 10 most recently updated
      this.learningPaths = this.learningPaths.slice(0, 10);
    }
    
    return true;
  }
  
  /**
   * Find knowledge gaps (connected topics with low engagement)
   * @returns {Array} - Knowledge gap recommendations
   */
  identifyKnowledgeGaps() {
    const gaps = [];
    const exploredTopics = Object.keys(this.topicGraph.nodes);
    
    // No topics explored yet
    if (exploredTopics.length === 0) {
      return [];
    }
    
    // Look for adjacent topics that have low engagement
    for (const edge in this.topicGraph.edges) {
      const [topicA, topicB] = edge.split('|');
      
      // If topics are connected but one has significantly higher engagement
      if (this.topicGraph.nodes[topicA] && this.topicGraph.nodes[topicB]) {
        const engagementA = this.topicGraph.nodes[topicA].engagementCount;
        const engagementB = this.topicGraph.nodes[topicB].engagementCount;
        
        // Check if one topic has at least 3x more engagement
        if (engagementA > engagementB * 3 && engagementB <= 2) {
          gaps.push({
            knownTopic: topicA,
            gapTopic: topicB,
            relevance: this.topicGraph.edges[edge].count,
            lastObserved: this.topicGraph.edges[edge].lastObserved
          });
        } else if (engagementB > engagementA * 3 && engagementA <= 2) {
          gaps.push({
            knownTopic: topicB,
            gapTopic: topicA,
            relevance: this.topicGraph.edges[edge].count,
            lastObserved: this.topicGraph.edges[edge].lastObserved
          });
        }
      }
    }
    
    // Sort by relevance (highest first) and recency
    return gaps.sort((a, b) => {
      // Prioritize recency if relevance is similar
      if (Math.abs(a.relevance - b.relevance) <= 1) {
        return new Date(b.lastObserved) - new Date(a.lastObserved);
      }
      return b.relevance - a.relevance;
    });
  }
  
  /**
   * Generate personalized recommendations for exploration
   * @returns {Object} - Exploration recommendations
   */
  async generateExplorationRecommendations() {
    // Get knowledge gaps (areas connected to known topics but unexplored)
    const gaps = this.identifyKnowledgeGaps().slice(0, 3);
    
    // Get next steps in current learning paths
    const nextSteps = await this.getNextLearningSteps();
    
    // Get related content for recently viewed topics
    const relatedContent = await this.getRelatedContent();
    
    // Combined recommendations
    return {
      gaps: gaps.map(gap => ({
        topic: gap.gapTopic,
        relatedToKnown: gap.knownTopic,
        searchQuery: `${gap.gapTopic} ${gap.knownTopic}`,
        relevance: gap.relevance
      })),
      nextSteps: nextSteps,
      relatedContent: relatedContent
    };
  }
  
  /**
   * Get next learning steps based on current paths
   * @returns {Promise<Array>} - Next learning step recommendations
   */
  async getNextLearningSteps() {
    const recommendations = [];
    
    // No learning paths yet
    if (this.learningPaths.length === 0) {
      return recommendations;
    }
    
    // Sort paths by recent activity
    const activePaths = [...this.learningPaths].sort((a, b) => 
      new Date(b.lastUpdated) - new Date(a.lastUpdated)
    );
    
    // Take the 3 most active paths
    const topPaths = activePaths.slice(0, 3);
    
    topPaths.forEach(path => {
      // Get the last 2 topics in the path
      const lastTopics = path.topics.slice(-2);
      
      if (lastTopics.length >= 2) {
        // Suggest next steps based on graph connections
        const lastTopic = lastTopics[1];
        const potentialNext = [];
        
        // Find topics connected to the last topic
        Object.keys(this.topicGraph.edges).forEach(edge => {
          const [topicA, topicB] = edge.split('|');
          
          // If edge contains our last topic
          if (topicA === lastTopic || topicB === lastTopic) {
            const nextTopic = topicA === lastTopic ? topicB : topicA;
            
            // Don't recommend topics already in the path
            if (!path.topics.includes(nextTopic)) {
              potentialNext.push({
                topic: nextTopic,
                count: this.topicGraph.edges[edge].count,
                lastObserved: this.topicGraph.edges[edge].lastObserved
              });
            }
          }
        });
        
        // Sort potential next steps by connection strength
        potentialNext.sort((a, b) => b.count - a.count);
        
        // Take top recommendation
        if (potentialNext.length > 0) {
          recommendations.push({
            currentPath: path.topics.join(' → '),
            nextTopic: potentialNext[0].topic,
            searchQuery: `${lastTopic} ${potentialNext[0].topic}`,
            strength: potentialNext[0].count
          });
        }
      }
    });
    
    return recommendations;
  }
  
  /**
   * Get related content recommendations based on recent activity
   * @returns {Promise<Array>} - Related content recommendations
   */
  async getRelatedContent() {
    const recommendations = [];
    
    // Get most engaged topics (top 5)
    const topTopics = Object.entries(this.topicGraph.nodes)
      .sort((a, b) => b[1].engagementCount - a[1].engagementCount)
      .slice(0, 5)
      .map(entry => entry[0]);
    
    // Find topic combinations not yet explored
    for (let i = 0; i < topTopics.length; i++) {
      for (let j = i + 1; j < topTopics.length; j++) {
        const topicPair = [topTopics[i], topTopics[j]].sort().join('|');
        
        // If combination doesn't exist or has low engagement
        if (!this.topicGraph.edges[topicPair] || 
            this.topicGraph.edges[topicPair].count <= 1) {
          
          recommendations.push({
            topic1: topTopics[i],
            topic2: topTopics[j],
            searchQuery: `${topTopics[i]} ${topTopics[j]}`,
            reason: `Combining your interests in ${topTopics[i]} and ${topTopics[j]}`
          });
        }
      }
    }
    
    // Limit to top 3
    return recommendations.slice(0, 3);
  }
  
  /**
   * Save agent data to storage
   * @returns {Promise} - Resolves when data is saved
   */
  async saveData() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        topicGraph: this.topicGraph,
        learningPaths: this.learningPaths
      }, resolve);
    });
  }
  
  /**
   * Reset all agent data
   * @returns {Promise} - Resolves when data is reset
   */
  async resetData() {
    this.topicGraph = {
      nodes: {},
      edges: {}
    };
    
    this.learningPaths = [];
    
    return this.saveData();
  }
}

/**
 * Agent that recognizes and tracks user's intent when using YouTube
 * to customize the experience accordingly
 */
class IntentAgent {
  constructor() {
    // User's recognized intents
    this.userIntents = {
      learning: {
        score: 0,
        topics: {}
      },
      entertainment: {
        score: 0,
        genres: {}
      },
      research: {
        score: 0,
        projects: {}
      },
      troubleshooting: {
        score: 0,
        problems: {}
      }
    };
    
    // Intent patterns for search queries
    this.intentPatterns = {
      learning: [
        /how\s+to/i, /tutorial/i, /learn/i, /course/i, /lesson/i, 
        /guide/i, /basics/i, /fundamentals/i, /explanation/i, /explained/i,
        /introduction\s+to/i, /beginner/i, /advanced/i, /masterclass/i
      ],
      entertainment: [
        /funny/i, /comedy/i, /entertainment/i, /music/i, /song/i, 
        /movie/i, /trailer/i, /gameplay/i, /stream/i, /vlog/i,
        /reaction/i, /review/i, /top\s+\d+/i, /best\s+of/i
      ],
      research: [
        /analysis/i, /study/i, /research/i, /in-depth/i, /case\s+study/i,
        /compare/i, /comparison/i, /versus/i, /vs/i, /difference\s+between/i,
        /evidence/i, /investigate/i, /experiment/i, /data/i
      ],
      troubleshooting: [
        /problem/i, /issue/i, /fix/i, /solved/i, /solution/i, 
        /troubleshoot/i, /error/i, /not\s+working/i, /help/i, /broken/i,
        /repair/i, /solve/i, /debug/i, /support/i
      ]
    };
  }
  
  /**
   * Initialize the intent agent
   * @returns {Promise} - Resolves when initialization is complete
   */
  async initialize() {
    return new Promise((resolve) => {
      // Load previous intent data
      chrome.storage.local.get('userIntents', (data) => {
        if (data.userIntents) {
          this.userIntents = data.userIntents;
        }
        
        resolve(true);
      });
    });
  }
  
  /**
   * Recognize user intent from search query and behavior
   * @param {string} query - Search query text
   * @param {string} behavior - Behavior type ('search', 'watch', etc.)
   * @returns {Promise<string>} - Recognized intent
   */
  async recognizeIntent(query, behavior) {
    try {
      // Analyze search query for intent signals
      const intentSignals = this.analyzeQueryIntent(query);
      
      // Update intent scores
      for (const intent in intentSignals) {
        this.userIntents[intent].score += intentSignals[intent];
        
        // Cap scores at reasonable levels
        if (this.userIntents[intent].score > 100) {
          this.userIntents[intent].score = 100;
        }
        
        // Decay other intents slightly
        for (const otherIntent in this.userIntents) {
          if (otherIntent !== intent && this.userIntents[otherIntent].score > 0) {
            this.userIntents[otherIntent].score *= 0.95;
          }
        }
      }
      
      // Update specific metadata based on recognized intent
      if (intentSignals.learning > intentSignals.entertainment) {
        // Extract learning topics from query
        const learningTopics = this.extractTopics(query, 'learning');
        
        learningTopics.forEach(topic => {
          if (!this.userIntents.learning.topics[topic]) {
            this.userIntents.learning.topics[topic] = 1;
          } else {
            this.userIntents.learning.topics[topic] += 1;
          }
        });
      } else if (intentSignals.entertainment > intentSignals.learning) {
        // Extract entertainment genres from query
        const entertainmentGenres = this.extractTopics(query, 'entertainment');
        
        entertainmentGenres.forEach(genre => {
          if (!this.userIntents.entertainment.genres[genre]) {
            this.userIntents.entertainment.genres[genre] = 1;
          } else {
            this.userIntents.entertainment.genres[genre] += 1;
          }
        });
      }
      
      // Save updated intents
      await this.saveData();
      
      // Return the current primary intent
      return this.getPrimaryIntent();
    } catch (error) {
      console.error('Intent recognition error:', error);
      return 'learning'; // Default to learning on error
    }
  }
  
  /**
   * Analyze query text for intent signals
   * @param {string} query - Search query text
   * @returns {Object} - Intent signals with scores
   */
  analyzeQueryIntent(query) {
    const intentSignals = {
      learning: 0,
      entertainment: 0,
      research: 0,
      troubleshooting: 0
    };
    
    // Check each intent pattern
    for (const intent in this.intentPatterns) {
      this.intentPatterns[intent].forEach(pattern => {
        if (pattern.test(query)) {
          intentSignals[intent] += 1;
        }
      });
    }
    
    // Look for explicit intent markers
    if (/teach|education|course|instructor|professor/i.test(query)) {
      intentSignals.learning += 2;
    }
    
    if (/funny|entertain|enjoy|relax|music|song|movie|trailer/i.test(query)) {
      intentSignals.entertainment += 2;
    }
    
    if (/study|report|analysis|evidence|theory|concept|history of/i.test(query)) {
      intentSignals.research += 2;
    }
    
    if (/problem|error|doesn't work|not working|fix|issue|bug/i.test(query)) {
      intentSignals.troubleshooting += 2;
    }
    
    return intentSignals;
  }
  
  /**
   * Get the current primary user intent
   * @returns {string} - Primary intent
   */
  getPrimaryIntent() {
    let primaryIntent = 'learning'; // Default
    let highestScore = -1;
    
    for (const intent in this.userIntents) {
      if (this.userIntents[intent].score > highestScore) {
        highestScore = this.userIntents[intent].score;
        primaryIntent = intent;
      }
    }
    
    return primaryIntent;
  }
  
  /**
   * Extract topics from query for a specific intent
   * @param {string} query - Search query text
   * @param {string} intent - Intent type
   * @returns {Array} - Extracted topics
   */
  extractTopics(query, intent) {
    const topics = [];
    
    // Simple topic extraction based on query keywords
    // This could be enhanced with NLP techniques
    switch (intent) {
      case 'learning':
        // Look for learning subjects
        const learningSubjects = [
          'programming', 'javascript', 'python', 'java', 'c++', 
          'web development', 'machine learning', 'data science',
          'history', 'physics', 'math', 'chemistry', 'biology',
          'photography', 'cooking', 'language', 'finance'
        ];
        
        learningSubjects.forEach(subject => {
          if (query.toLowerCase().includes(subject)) {
            topics.push(subject);
          }
        });
        break;
        
      case 'entertainment':
        // Look for entertainment genres
        const entertainmentGenres = [
          'gaming', 'music', 'comedy', 'vlog', 'travel',
          'food', 'sports', 'movie', 'tv show', 'anime',
          'reaction', 'review', 'unboxing', 'challenge'
        ];
        
        entertainmentGenres.forEach(genre => {
          if (query.toLowerCase().includes(genre)) {
            topics.push(genre);
          }
        });
        break;
        
      case 'research':
        // Look for research topics
        const researchTopics = [
          'analysis', 'study', 'research', 'theory', 'concept',
          'history', 'development', 'evolution', 'impact',
          'comparison', 'review', 'overview', 'introduction'
        ];
        
        researchTopics.forEach(topic => {
          if (query.toLowerCase().includes(topic)) {
            topics.push(topic);
          }
        });
        break;
        
      case 'troubleshooting':
        // Look for problem topics
        const problemTopics = [
          'error', 'issue', 'problem', 'bug', 'fix',
          'solution', 'troubleshoot', 'repair', 'help'
        ];
        
        problemTopics.forEach(topic => {
          if (query.toLowerCase().includes(topic)) {
            topics.push(topic);
          }
        });
        break;
    }
    
    return topics;
  }
  
  /**
   * Get interface configuration based on recognized intent
   * @returns {Promise<Object>} - Interface configuration
   */
  async getInterfaceConfiguration() {
    const primaryIntent = this.getPrimaryIntent();
    let interfaceConfig = {};
    
    switch (primaryIntent) {
      case 'learning':
        interfaceConfig = {
          noteMode: true,
          showTranscript: true,
          showChapters: true,
          hideComments: true,
          playbackRate: 1.0,
          showRelatedVideos: false,
          showProgressBar: true
        };
        break;
        
      case 'entertainment':
        interfaceConfig = {
          noteMode: false,
          showTranscript: false,
          showChapters: false,
          hideComments: false,
          playbackRate: 1.0,
          showRelatedVideos: true,
          showProgressBar: true
        };
        break;
        
      case 'research':
        interfaceConfig = {
          noteMode: true,
          showTranscript: true,
          showChapters: true,
          hideComments: false,
          playbackRate: 1.25,
          showRelatedVideos: false,
          showProgressBar: true
        };
        break;
        
      case 'troubleshooting':
        interfaceConfig = {
          noteMode: true,
          showTranscript: true,
          showChapters: true,
          hideComments: true,
          playbackRate: 0.75,
          showRelatedVideos: false,
          showProgressBar: true
        };
        break;
        
      default:
        // Default configuration
        interfaceConfig = {
          noteMode: false,
          showTranscript: false,
          showChapters: true,
          hideComments: true,
          playbackRate: 1.0,
          showRelatedVideos: false,
          showProgressBar: true
        };
    }
    
    return interfaceConfig;
  }
  
  /**
   * Save agent data to storage
   * @returns {Promise} - Resolves when data is saved
   */
  async saveData() {
    return new Promise((resolve) => {
      chrome.storage.local.set({
        userIntents: this.userIntents
      }, resolve);
    });
  }
  
  /**
   * Reset all agent data
   * @returns {Promise} - Resolves when data is reset
   */
  async resetData() {
    this.userIntents = {
      learning: {
        score: 0,
        topics: {}
      },
      entertainment: {
        score: 0,
        genres: {}
      },
      research: {
        score: 0,
        projects: {}
      },
      troubleshooting: {
        score: 0,
        problems: {}
      }
    };
    
    return this.saveData();
  }
}

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

// ========================================================
// BACKGROUND SCRIPT MAIN FUNCTIONALITY
// ========================================================

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