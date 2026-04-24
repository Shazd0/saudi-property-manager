// Screen Time Tracking Service
// Tracks user session time and calculates usage statistics

export interface SessionRecord {
  userId: string;
  userName: string;
  startTime: number;
  endTime: number;
  duration: number; // in milliseconds
  date: string; // YYYY-MM-DD
}

export interface UsageStats {
  userId: string;
  userName: string;
  totalTime: number; // total milliseconds
  totalDays: number; // number of unique days
  averagePerDay: number; // average milliseconds per day
  lastSession: number; // timestamp
  sessions: SessionRecord[];
}

const STORAGE_KEY = 'screenTimeData';
const ACTIVE_SESSION_KEY = 'activeSession';

// Get all screen time data from localStorage
const getData = (): Record<string, UsageStats> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Failed to load screen time data:', error);
    return {};
  }
};

// Save screen time data to localStorage
const saveData = (data: Record<string, UsageStats>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save screen time data:', error);
  }
};

// Start tracking session
export const startSession = (userId: string, userName: string) => {
  const session = {
    userId,
    userName,
    startTime: Date.now(),
    date: new Date().toISOString().split('T')[0]
  };
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
};

// End tracking session and save to history
export const endSession = () => {
  try {
    const activeSessionStr = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeSessionStr) return;

    const activeSession = JSON.parse(activeSessionStr);
    const endTime = Date.now();
    const duration = endTime - activeSession.startTime;

    // Don't save sessions less than 10 seconds (likely page refreshes)
    if (duration < 10000) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }

    const sessionRecord: SessionRecord = {
      userId: activeSession.userId,
      userName: activeSession.userName,
      startTime: activeSession.startTime,
      endTime,
      duration,
      date: activeSession.date
    };

    // Update user stats
    const data = getData();
    if (!data[activeSession.userId]) {
      data[activeSession.userId] = {
        userId: activeSession.userId,
        userName: activeSession.userName,
        totalTime: 0,
        totalDays: 0,
        averagePerDay: 0,
        lastSession: 0,
        sessions: []
      };
    }

    const userStats = data[activeSession.userId];
    userStats.sessions.push(sessionRecord);
    userStats.totalTime += duration;
    userStats.lastSession = endTime;

    // Calculate unique days
    const uniqueDays = new Set(userStats.sessions.map(s => s.date));
    userStats.totalDays = uniqueDays.size;
    userStats.averagePerDay = userStats.totalTime / userStats.totalDays;

    saveData(data);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (error) {
    console.error('Failed to end session:', error);
  }
};

// Update current session (called periodically)
export const updateSession = () => {
  try {
    const activeSessionStr = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeSessionStr) return;

    const activeSession = JSON.parse(activeSessionStr);
    const currentTime = Date.now();
    const duration = currentTime - activeSession.startTime;

    // Auto-save every 5 minutes
    if (duration > 5 * 60 * 1000) {
      endSession();
      startSession(activeSession.userId, activeSession.userName);
    }
  } catch (error) {
    console.error('Failed to update session:', error);
  }
};

// Get user statistics
export const getUserStats = (userId: string): UsageStats | null => {
  const data = getData();
  return data[userId] || null;
};

// Get all users statistics (admin only)
export const getAllUsersStats = (): UsageStats[] => {
  const data = getData();
  return Object.values(data).sort((a, b) => b.totalTime - a.totalTime);
};

// Get current session duration
export const getCurrentSessionDuration = (): number => {
  try {
    const activeSessionStr = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeSessionStr) return 0;

    const activeSession = JSON.parse(activeSessionStr);
    return Date.now() - activeSession.startTime;
  } catch (error) {
    return 0;
  }
};

// Format milliseconds to readable time
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  } else if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    return `${seconds}s`;
  }
};
