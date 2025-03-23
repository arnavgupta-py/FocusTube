// FocusTube - Time Management Agent
// This agent helps users manage their YouTube viewing time

/**
 * Agent that monitors and manages YouTube usage time
 * to prevent excessive consumption and encourage healthy habits
 */
export class TimeManagementAgent {
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
  
  // Make available to other extension components
  window.TimeManagementAgent = TimeManagementAgent;