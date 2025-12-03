// API base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

// Export the base request function for other API calls
export default apiRequest;