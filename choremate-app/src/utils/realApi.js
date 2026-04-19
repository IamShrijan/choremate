// In production: Nginx proxies /api/* → backend ALB (no absolute URL needed).
// In local dev (npm run dev, no Nginx): set VITE_API_BASE_URL=http://localhost:8000 in .env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Helper to get auth token from localStorage
const getAuthToken = () => {
  return sessionStorage.getItem('auth_token');
};

// Helper to set auth token
const setAuthToken = (token) => {
  sessionStorage.setItem('auth_token', token);
};

// Helper to remove auth token
const removeAuthToken = () => {
  sessionStorage.removeItem('auth_token');
};

// Generic API request function
const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || 'Request failed');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

// Auth API functions
export const authAPI = {
  signup: async (name, email, password) => {
    return apiRequest('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
  },

  login: async (email, password) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    // Store token after successful login
    if (response.access_token) {
      setAuthToken(response.access_token);
    }

    return response;
  },

  logout: async () => {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
      });
    } finally {
      // Always remove token from localStorage, even if API call fails
      removeAuthToken();
    }
  },
};

// House API functions
export const houseAPI = {
  createHouse: async (houseData) => {
    return apiRequest('/house/create', {
      method: 'POST',
      body: JSON.stringify(houseData),
    });
  },

  inviteRoommates: async (emails) => {
    return apiRequest('/house/invite-roommates', {
      method: 'POST',
      body: JSON.stringify({ emails }),
    });
  },

  getMembersStatus: async () => {
    return apiRequest('/house/members-status');
  },

  joinHouse: async (inviteCode) => {
    return apiRequest('/house/join', {
      method: 'POST',
      body: JSON.stringify({ invite_code: inviteCode }),
    });
  },

  leaveHouse: async () => {
    return apiRequest('/house/leave', {
      method: 'POST',
    });
  },
};


// User API functions
export const userAPI = {
  getMe: async () => {
    return apiRequest('/user/me');
  },

  getProfile: async () => {
    return apiRequest('/user/profile');
  },

  fetchRoommates: async () => {
    return apiRequest('/user/fetch-roommates');
  },
};


// User preferences API
export const preferencesAPI = {
  updatePreferences: async (preferencesData) => {
    return apiRequest('/user-preferences/update', {
      method: 'POST',
      body: JSON.stringify(preferencesData),
    });
  },

  getMyPreferences: async () => {
    return apiRequest('/user-preferences/my-preferences');
  },
};

// Chores / schedule API
export const choresAPI = {
  generateHouseChores: async () => {
    return apiRequest('/chores/generate-house-chores', {
      method: 'POST',
    });
  },
  saveGeneratedChores: async (chores) => {
    return apiRequest('/chores/add-chores', {
      method: 'POST',
      body: JSON.stringify(chores),
    });
  },

  // Generate monthly tickets for all chores in the house using AI
  generateMonthlyTickets: async () => {
    return apiRequest('/chores/generate-monthly-tickets', {
      method: 'POST',
    });
  },

  getChores: async () => {
    return apiRequest('/chores/my-tickets', {
      method: 'GET',
    });
  },

  getChoresByHouse: async () => {
    return apiRequest('/chores/house-chores', {
      method: 'GET',
    });
  },

  // Mark a ticket as complete
  markComplete: async (ticketId) => {
    return apiRequest(`/chores/ticket/${ticketId}/complete`, {
      method: 'PATCH',
    });
  },

  // Update ticket due date
  updateDueDate: async (ticketId, dueDate) => {
    return apiRequest(`/chores/ticket/${ticketId}/due-date`, {
      method: 'PATCH',
      body: JSON.stringify({ due_date: dueDate }),
    });
  },

  // Update ticket assignment
  updateAssignment: async (ticketId, assignedUserId) => {
    return apiRequest(`/chores/ticket/${ticketId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigned_user_id: assignedUserId }),
    });
  },
};

// Stats API functions
export const statsAPI = {
  getFairnessReport: async () => {
    return apiRequest('/stats/fairness-report', {
      method: 'GET',
    });
  },

  getLeaderboard: async () => {
    return apiRequest('/stats/leaderboard', {
      method: 'GET',
    });
  },

  getDashboardStats: async () => {
    return apiRequest('/stats/dashboard', {
      method: 'GET',
    });
  },
};

// Chatbot API functions
export const chatbotAPI = {
  chat: async (data) => {
    return apiRequest('/ai-chatbot/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  approveAction: async (data) => {
    return apiRequest('/ai-chatbot/approve-action', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getConversations: async () => {
    return apiRequest('/ai-chatbot/conversations', {
      method: 'GET',
    });
  },
};

// Notifications API functions
export const notificationsAPI = {
  getNotifications: async () => {
    return apiRequest('/notifications/', {
      method: 'GET',
    });
  },

  markRead: async (notificationId) => {
    return apiRequest(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
  },

  dismiss: async (notificationId) => {
    return apiRequest(`/notifications/${notificationId}`, {
      method: 'DELETE',
    });
  },

  sendAppreciation: async (targetUserId, message) => {
    return apiRequest('/notifications/appreciation', {
      method: 'POST',
      body: JSON.stringify({ target_user_id: targetUserId, message }),
    });
  },

  /**
   * Opens a Server-Sent Events stream for real-time notification push.
   *
   * EventSource cannot send custom headers, so the JWT is passed as a
   * query param. The backend's /notifications/stream endpoint accepts it.
   *
   * Returns the EventSource instance so the caller can attach listeners
   * and call .close() on unmount.
   *
   * Usage:
   *   const es = notificationsAPI.openStream();
   *   es.addEventListener('new_notification', () => fetchNotifications());
   *   // on unmount:
   *   es.close();
   */
  openStream: () => {
    const token = sessionStorage.getItem('auth_token');
    const base = import.meta.env.VITE_API_BASE_URL || '/api';
    const url = `${base}/notifications/stream?token=${encodeURIComponent(token)}`;
    return new EventSource(url);
  },
};

// Export the base request function for other API calls
export default apiRequest;