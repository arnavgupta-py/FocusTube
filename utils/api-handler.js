/**
 * YouTube API Handler
 * This module handles all interactions with the YouTube Data API
 */
const YouTubeAPI = (() => {
    // YouTube API key - you'll need to get your own from Google Cloud Console
    // For development, we'll use a dummy key that will need to be replaced
    const API_KEY = 'AIzaSyDVZzOtnNjFadDloyv1Cjd6yKuVha4lMSU';
    
    // API Base URL
    const API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
    
    /**
     * Search for videos on YouTube
     * @param {string} query - Search query
     * @param {number} maxResults - Maximum number of results to return
     * @returns {Promise<Array>} - List of video results
     */
    const search = async (query, maxResults = 20) => {
      try {
        // Step 1: Search for videos matching the query
        const searchResponse = await fetch(
          `${API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=${maxResults}&type=video&key=${API_KEY}`
        );
        
        if (!searchResponse.ok) {
          const errorData = await searchResponse.json();
          throw new Error(errorData.error?.message || 'Failed to search YouTube');
        }
        
        const searchData = await searchResponse.json();
        
        // Extract video IDs for detailed info
        const videoIds = searchData.items.map(item => item.id.videoId).join(',');
        
        // Step 2: Get detailed video information
        const videoResponse = await fetch(
          `${API_BASE_URL}/videos?part=snippet,contentDetails,statistics&id=${videoIds}&key=${API_KEY}`
        );
        
        if (!videoResponse.ok) {
          const errorData = await videoResponse.json();
          throw new Error(errorData.error?.message || 'Failed to get video details');
        }
        
        const videoData = await videoResponse.json();
        
        // Step 3: Format and return the results
        return videoData.items.map(item => ({
          id: item.id,
          title: item.snippet.title,
          description: item.snippet.description,
          channelId: item.snippet.channelId,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          thumbnail: item.snippet.thumbnails.high.url,
          duration: item.contentDetails.duration,
          viewCount: parseInt(item.statistics.viewCount),
          likeCount: parseInt(item.statistics.likeCount || 0),
          commentCount: parseInt(item.statistics.commentCount || 0)
        }));
      } catch (error) {
        console.error('YouTube API Error:', error);
        
        // If API key is missing or invalid, provide helpful development data
        if (API_KEY === 'YOUR_YOUTUBE_API_KEY' || error.message.includes('API key')) {
          return getMockData(query, maxResults);
        }
        
        throw error;
      }
    };
    
    /**
     * Get mock data for development purposes
     * @param {string} query - Search query 
     * @param {number} maxResults - Maximum number of results
     * @returns {Array} - Mock video results
     */
    const getMockData = (query, maxResults) => {
      // Generate some mock data based on the query for development
      const mockVideos = [];
      
      for (let i = 1; i <= maxResults; i++) {
        mockVideos.push({
          id: `mock-id-${i}`,
          title: `${query} - Sample Video ${i}`,
          description: `This is a sample description for a video about ${query}.`,
          channelId: 'sample-channel-id',
          channelTitle: 'Sample Channel',
          publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
          thumbnail: 'https://via.placeholder.com/480x360.png?text=YouTube+Focus',
          duration: 'PT10M30S',
          viewCount: 10000 * i,
          likeCount: 500 * i,
          commentCount: 50 * i
        });
      }
      
      return mockVideos;
    };
    
    // Public API
    return {
      search
    };
  })();
  
  // Export for use in other scripts
  window.YouTubeAPI = YouTubeAPI;