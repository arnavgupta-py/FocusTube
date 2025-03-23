// FocusTube - Content Learning Agent
// This agent learns user content preferences and ranks videos accordingly

/**
 * Agent that learns about content preferences from user engagement
 * and applies this knowledge to rank search results
 */
export class ContentLearningAgent {
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
      const combinedText = `${videoData.title} ${videoData.description || ''}`.toLowerCase();
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
        if (pattern.test(videoData.title)) {
          formats.push(format);
        }
      }
      
      return {
        channelId: videoData.channelId,
        channelTitle: videoData.channelTitle,
        durationCategory,
        topics: Array.from(topics),
        formats: formats.length > 0 ? formats : ['uncategorized'],
        publishedAt: videoData.publishedAt,
        viewCount: videoData.viewCount
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
        const recencyFactor = Math.max(0.1, Math.min(1, (now - engagement.lastWatched) / (30 * 24 * 60 * 60 * 1000)));
        const engagementScore = (engagement.positive - engagement.negative * 0.5) * recencyFactor;
        
        // Skip videos with negative overall engagement
        if (engagementScore <= 0) continue;
        
        const metadata = engagement.metadata;
        
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
  
  // Make available to other extension components
  window.ContentLearningAgent = ContentLearningAgent;