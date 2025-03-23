// FocusTube - Intent Recognition Agent
// This agent recognizes user intent from their search queries and behavior

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
      
      // Behavioral patterns for intent recognition
      this.behaviorPatterns = {
        learning: {
          watchDuration: 0.7, // Higher percentage of video watched
          rewindCount: 3,     // More rewinds
          pauseCount: 4,      // More pauses
          playbackRate: 1.0   // Varied playback rate
        },
        entertainment: {
          watchDuration: 0.5, // Medium percentage of video watched
          rewindCount: 0,     // Fewer rewinds
          pauseCount: 1,      // Fewer pauses
          playbackRate: 1.0   // Normal playback rate
        },
        research: {
          watchDuration: 0.6, // Medium-high percentage watched
          rewindCount: 2,     // Some rewinds
          pauseCount: 3,      // Some pauses
          playbackRate: 1.25  // Often faster playback
        },
        troubleshooting: {
          watchDuration: 0.4, // Variable watch duration
          rewindCount: 5,     // Many rewinds
          pauseCount: 5,      // Many pauses
          playbackRate: 0.75  // Often slower playback
        }
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
  
  // Make available to other extension components
  window.IntentAgent = IntentAgent;