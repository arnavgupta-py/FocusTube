// FocusTube - Information Discovery Agent
// This agent helps users explore topics more effectively and find valuable content

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
              relatedVideos: [videoData.id],
              title: topic
            };
          } else {
            // Update existing topic
            this.topicGraph.nodes[topic].engagementCount += 1;
            this.topicGraph.nodes[topic].lastViewed = new Date().toISOString();
            
            // Add video ID if not already in list
            if (!this.topicGraph.nodes[topic].relatedVideos.includes(videoData.id)) {
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
      
      // Combine title and description
      const text = `${videoData.title} ${videoData.description || ''}`.toLowerCase();
      
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
  
  // Make available to other extension components
  window.DiscoveryAgent = DiscoveryAgent;