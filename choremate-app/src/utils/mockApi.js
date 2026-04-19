/**
 * ============================================================
 *  ChoreMate Mock Backend
 * ============================================================
 *  Drop-in replacement for realApi.js.
 *  Activated when VITE_USE_MOCK=true.
 *
 *  Delay config (ms):
 *    VITE_MOCK_DELAY_MS      – regular endpoints   (default: 200)
 *    VITE_MOCK_LLM_DELAY_MS  – LLM-backed endpoints (default: 3500)
 *
 *  All in-memory state is module-scoped so it survives navigation
 *  but resets on a hard refresh (F5) — intentional for load testing.
 * ============================================================
 */

const DELAY = Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 200);
const LLM_DELAY = Number(import.meta.env.VITE_MOCK_LLM_DELAY_MS ?? 3500);

/** Sleep helper with optional ±jitter */
const sleep = (base, jitter = 0) => {
  const ms = base + (jitter ? Math.random() * jitter * 2 - jitter : 0);
  return new Promise((r) => setTimeout(r, ms));
};

// ─────────────────────────────────────────────────────────────
// Seed data
// ─────────────────────────────────────────────────────────────

const SEED_USERS = [
  {
    id: 'user-alice',
    name: 'Alice Chen',
    email: 'alice@example.com',
    password: 'password',
    house_id: 'house-1',
    is_admin: true,
  },
  {
    id: 'user-bob',
    name: 'Bob Martinez',
    email: 'bob@example.com',
    password: 'password',
    house_id: 'house-1',
    is_admin: false,
  },
  {
    id: 'user-carol',
    name: 'Carol Kim',
    email: 'carol@example.com',
    password: 'password',
    house_id: 'house-1',
    is_admin: false,
  },
];

const SEED_HOUSE = {
  id: 'house-1',
  name: 'Sunset Apartments',
  invite_code: 'SUNSET42',
};

const SEED_CHORE_TEMPLATES = [
  { id: 'chore-1', name: 'Wash Dishes', description: 'Clean all dishes in the sink', difficulty_level: 1, duration: 20, chore_frequency: 'Daily', chore_priority: 3, icon: '🍽️', notes: '' },
  { id: 'chore-2', name: 'Take Out Trash', description: 'Empty all bins and take to curb', difficulty_level: 1, duration: 15, chore_frequency: 'Weekly', chore_priority: 3, icon: '🗑️', notes: '' },
  { id: 'chore-3', name: 'Vacuum Living Room', description: 'Vacuum carpets and rugs', difficulty_level: 2, duration: 30, chore_frequency: 'Weekly', chore_priority: 2, icon: '🧹', notes: '' },
  { id: 'chore-4', name: 'Clean Bathroom', description: 'Scrub toilet, sink, and shower', difficulty_level: 3, duration: 45, chore_frequency: 'Weekly', chore_priority: 3, icon: '🪠', notes: '' },
  { id: 'chore-5', name: 'Wipe Kitchen Counters', description: 'Sanitize all kitchen surfaces', difficulty_level: 1, duration: 10, chore_frequency: 'Daily', chore_priority: 2, icon: '🧽', notes: '' },
  { id: 'chore-6', name: 'Mop Floors', description: 'Mop all hard floors throughout the apartment', difficulty_level: 2, duration: 40, chore_frequency: 'Biweekly', chore_priority: 2, icon: '🧹', notes: '' },
  { id: 'chore-7', name: 'Grocery Shopping', description: 'Buy household essentials and shared items', difficulty_level: 2, duration: 60, chore_frequency: 'Weekly', chore_priority: 2, icon: '🛒', notes: '' },
  { id: 'chore-8', name: 'Dust Shelves & Surfaces', description: 'Dust all shelves, TV stand, and surfaces', difficulty_level: 1, duration: 25, chore_frequency: 'Weekly', chore_priority: 1, icon: '✨', notes: '' },
];

// ─────────────────────────────────────────────────────────────
// In-memory mutable state
// ─────────────────────────────────────────────────────────────

let _users = SEED_USERS.map((u) => ({ ...u }));
let _chores = SEED_CHORE_TEMPLATES.map((c) => ({ ...c }));
let _tickets = [];
let _notifications = [];
/** Set of fireEvent callbacks registered by openStream() instances */
const _mockStreamListeners = new Set();

let _conversations = {};

/** Who is currently "logged in" — tracked via sessionStorage (same key as real app) */
const SESSION_KEY = 'auth_token';
const getUserFromSession = () => {
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token || !token.startsWith('mock-token-')) return null;
  const userId = token.replace('mock-token-', '');
  return _users.find((u) => u.id === userId) ?? null;
};

const setSession = (user) => {
  sessionStorage.setItem(SESSION_KEY, `mock-token-${user.id}`);
};

const clearSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
};

// ─────────────────────────────────────────────────────────────
// Ticket generation helper
// ─────────────────────────────────────────────────────────────

let _ticketIdCounter = 1;

const generateTickets = () => {
  const today = new Date();
  const members = _users.filter((u) => u.house_id === 'house-1');
  _tickets = [];

  _chores.forEach((chore, i) => {
    const assignee = members[i % members.length];
    const due = new Date(today);
    due.setDate(today.getDate() + (i % 7));

    _tickets.push({
      ticket_id: `ticket-${_ticketIdCounter++}`,
      chore_name: chore.name,
      chore_id: chore.id,
      assigned_user_id: assignee.id,
      assigned_user_name: assignee.name,
      due_date: due.toISOString().split('T')[0],
      duration: chore.duration,
      difficulty_level: chore.difficulty_level,
      notes: chore.notes,
      completed: false,
    });
  });
};

// Seed notifications
const seedNotifications = () => {
  _notifications = [
    { id: 'notif-1', message: 'Bob completed "Wash Dishes" 🎉', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString(), type: 'completion' },
    { id: 'notif-2', message: 'Carol sent you an appreciation ❤️', is_read: false, created_at: new Date(Date.now() - 7200000).toISOString(), type: 'appreciation' },
    { id: 'notif-3', message: 'Reminder: "Clean Bathroom" is due tomorrow', is_read: true, created_at: new Date(Date.now() - 86400000).toISOString(), type: 'reminder' },
  ];
};

seedNotifications();

// ─────────────────────────────────────────────────────────────
// AI chatbot canned responses
// ─────────────────────────────────────────────────────────────

const getCannedResponse = (message) => {
  const lower = message.toLowerCase();

  if (lower.includes('busy') || lower.includes('reassign') || lower.includes('can\'t') || lower.includes('weekend')) {
    return {
      response: "I understand you're busy! I've looked at your roommates' schedules and found that Bob has capacity this weekend. I can reassign your chores (Vacuum Living Room, Mop Floors) to Bob. Would you like me to proceed?",
      proposed_action: {
        action_id: `action-${Date.now()}`,
        type: 'reassign',
        description: 'Reassign weekend chores to Bob Martinez',
        chores: ['Vacuum Living Room', 'Mop Floors'],
        from: 'You',
        to: 'Bob Martinez',
      },
      conversation_id: `conv-${Date.now()}`,
    };
  }

  if (lower.includes('upcoming') || lower.includes('my chores') || lower.includes('schedule')) {
    const user = getUserFromSession();
    const myTickets = _tickets.filter((t) => t.assigned_user_id === user?.id && !t.completed).slice(0, 3);
    const choreList = myTickets.length > 0
      ? myTickets.map((t) => `• ${t.chore_name} (due ${t.due_date})`).join('\n')
      : '• No upcoming chores! You\'re all caught up 🎉';
    return {
      response: `Here are your upcoming chores:\n\n${choreList}\n\nWould you like me to help reschedule any of these?`,
      proposed_action: null,
      conversation_id: `conv-${Date.now()}`,
    };
  }

  if (lower.includes('help') || lower.includes('tomorrow')) {
    return {
      response: "I can help you with tomorrow's chores! Looking at the schedule, you have \"Wipe Kitchen Counters\" due tomorrow. It should only take about 10 minutes. Would you like me to set a reminder, or is there something you'd like to reschedule?",
      proposed_action: null,
      conversation_id: `conv-${Date.now()}`,
    };
  }

  if (lower.includes('fair') || lower.includes('equit') || lower.includes('balance')) {
    return {
      response: "Based on this month's data, the chore distribution is fairly balanced:\n\n• Alice: 12 chores completed (38%)\n• Bob: 10 chores completed (31%)\n• Carol: 10 chores completed (31%)\n\nEveryone is pulling their weight! 🌟",
      proposed_action: null,
      conversation_id: `conv-${Date.now()}`,
    };
  }

  return {
    response: "I'm here to help with chore management! I can reassign chores based on your roommates' availability, show your upcoming schedule, or help with any chore-related questions. What would you like to do?",
    proposed_action: null,
    conversation_id: `conv-${Date.now()}`,
  };
};

// ─────────────────────────────────────────────────────────────
// Mock API implementations — mirroring realApi.js exports exactly
// ─────────────────────────────────────────────────────────────

export const authAPI = {
  signup: async (name, email, password) => {
    await sleep(DELAY);
    if (_users.find((u) => u.email === email)) {
      throw new Error('An account with this email already exists.');
    }
    const newUser = {
      id: `user-${Date.now()}`,
      name,
      email,
      password,
      house_id: null,
      is_admin: false,
    };
    _users.push(newUser);
    return { message: 'User created successfully' };
  },

  login: async (email, password) => {
    await sleep(DELAY);
    // Accept any known user with any password, OR allow dynamic users created via signup
    const user = _users.find((u) => u.email === email);
    if (!user) {
      throw new Error('No account found with this email. Please sign up first.');
    }
    setSession(user);
    return { access_token: `mock-token-${user.id}`, token_type: 'bearer' };
  },

  logout: async () => {
    await sleep(DELAY / 2);
    clearSession();
    return { message: 'Logged out' };
  },
};

export const houseAPI = {
  createHouse: async (houseData) => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    // Assign user to the house
    user.house_id = 'house-1';
    user.is_admin = true;
    return { id: 'house-1', name: houseData.name || SEED_HOUSE.name, invite_code: SEED_HOUSE.invite_code };
  },

  inviteRoommates: async (emails) => {
    await sleep(DELAY);
    return { message: `Invitations sent to ${emails.join(', ')}` };
  },

  getMembersStatus: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    const members = _users
      .filter((u) => u.house_id === user.house_id)
      .map((u) => ({
        user_id: u.id,
        name: u.name,
        email: u.email,
        survey_completed: true,
        is_admin: u.is_admin,
      }));
    return {
      house_id: user.house_id,
      house_name: SEED_HOUSE.name,
      is_admin: user.is_admin,
      all_completed: true,
      members,
    };
  },

  joinHouse: async (inviteCode) => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    if (inviteCode !== SEED_HOUSE.invite_code) {
      throw new Error('Invalid invite code. Please check and try again.');
    }
    user.house_id = 'house-1';
    return { message: 'Joined house successfully', house_id: 'house-1' };
  },

  leaveHouse: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    user.house_id = null;
    user.is_admin = false;
    return { message: 'Left house successfully' };
  },
};

export const userAPI = {
  getMe: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      house_id: user.house_id,
    };
  },

  getProfile: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      house_id: user.house_id,
      is_admin: user.is_admin,
    };
  },

  fetchRoommates: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    const roommates = _users.filter((u) => u.house_id === user.house_id && u.id !== user.id);
    return roommates.map((u) => ({ id: u.id, name: u.name, email: u.email }));
  },

  // Called from dashboard.jsx — graceful no-op in mock
  logout: async () => {
    await sleep(DELAY / 2);
    clearSession();
    return { message: 'Logged out' };
  },

  // Called from dashboard.jsx feedback modal
  submitFeedback: async (message) => {
    await sleep(DELAY);
    console.log('[MockAPI] Feedback submitted:', message);
    return { message: 'Feedback received, thank you!' };
  },
};

export const preferencesAPI = {
  updatePreferences: async (preferencesData) => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    // Store on user object
    user.preferences = { ...user.preferences, ...preferencesData };
    return { message: 'Preferences updated', ...user.preferences };
  },

  getMyPreferences: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    return user.preferences ?? {
      preferred_chores: [],
      disliked_chores: [],
      availability: { weekdays: true, weekends: true },
      max_weekly_hours: 3,
    };
  },
};

export const choresAPI = {
  /**
   * LLM endpoint — simulates AI generating a chore plan for the household.
   * Uses LLM_DELAY with ±500ms jitter.
   */
  generateHouseChores: async () => {
    await sleep(LLM_DELAY, 500);
    return {
      status: 'success',
      total_chores_created: _chores.length,
      chores: _chores.map((c) => ({ ...c })),
    };
  },

  saveGeneratedChores: async (chores) => {
    await sleep(DELAY);
    // Replace in-memory chores with the saved ones
    _chores = chores.map((c, i) => ({
      ...c,
      id: c.id || `chore-saved-${i}`,
      icon: c.icon || '✨',
    }));
    return { status: 'chores added to db', count: _chores.length };
  },

  /**
   * LLM endpoint — AI assigns chores to each roommate for the month.
   */
  generateMonthlyTickets: async () => {
    await sleep(LLM_DELAY, 500);
    generateTickets();
    return {
      status: 'success',
      message: 'Monthly tickets generated successfully',
      tickets_created: _tickets.length,
    };
  },

  getChores: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    if (_tickets.length === 0) generateTickets();
    return _tickets
      .filter((t) => t.assigned_user_id === user.id)
      .map((t) => ({ ...t }));
  },

  getChoresByHouse: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (!user) throw new Error('Not authenticated');
    if (_tickets.length === 0) generateTickets();
    return _tickets.map((t) => ({ ...t }));
  },

  markComplete: async (ticketId) => {
    await sleep(DELAY);
    const ticket = _tickets.find((t) => t.ticket_id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    ticket.completed = true;
    ticket.completed_at = new Date().toISOString();
    return { message: 'Ticket marked complete', ticket_id: ticketId };
  },

  updateDueDate: async (ticketId, dueDate) => {
    await sleep(DELAY);
    const ticket = _tickets.find((t) => t.ticket_id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    ticket.due_date = dueDate;
    return { message: 'Due date updated', ticket_id: ticketId };
  },

  updateAssignment: async (ticketId, assignedUserId) => {
    await sleep(DELAY);
    const ticket = _tickets.find((t) => t.ticket_id === ticketId);
    if (!ticket) throw new Error('Ticket not found');
    const newAssignee = _users.find((u) => u.id === assignedUserId);
    if (!newAssignee) throw new Error('User not found');
    ticket.assigned_user_id = newAssignee.id;
    ticket.assigned_user_name = newAssignee.name;
    return { message: 'Assignment updated', ticket_id: ticketId };
  },
};

export const statsAPI = {
  getFairnessReport: async () => {
    await sleep(DELAY);
    const members = _users.filter((u) => u.house_id === 'house-1');
    return members.map((u, i) => ({
      user_id: u.id,
      name: u.name,
      completed_count: [12, 10, 10][i] ?? 8,
      pending_count: [2, 3, 4][i] ?? 3,
      fairness_score: [95, 88, 87][i] ?? 85,
    }));
  },

  getLeaderboard: async () => {
    await sleep(DELAY);
    const members = _users.filter((u) => u.house_id === 'house-1');
    return members
      .map((u, i) => ({
        user_id: u.id,
        name: u.name,
        points: [340, 280, 275][i] ?? 200,
        rank: i + 1,
        badge: i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉',
      }))
      .sort((a, b) => a.rank - b.rank);
  },

  getDashboardStats: async () => {
    await sleep(DELAY);
    const user = getUserFromSession();
    if (_tickets.length === 0) generateTickets();
    const myTickets = _tickets.filter((t) => t.assigned_user_id === user?.id);
    const pending = myTickets.filter((t) => !t.completed).length;
    const completed = myTickets.filter((t) => t.completed).length;
    return {
      pending_chores_week: pending,
      completed_chores_week: completed,
      appreciations_month: 3,
    };
  },
};

export const chatbotAPI = {
  /**
   * LLM endpoint — returns a canned AI response based on message intent.
   */
  chat: async (data) => {
    await sleep(LLM_DELAY, 500);
    const response = getCannedResponse(data.message || '');
    if (data.conversation_id) {
      response.conversation_id = data.conversation_id;
    }
    // Store conversation
    const convId = response.conversation_id;
    if (!_conversations[convId]) _conversations[convId] = [];
    _conversations[convId].push({ role: 'user', content: data.message });
    _conversations[convId].push({ role: 'ai', content: response.response });
    return response;
  },

  /**
   * LLM endpoint — confirms or cancels a proposed chore action.
   */
  approveAction: async (data) => {
    await sleep(Math.floor(LLM_DELAY / 2), 300);
    if (data.approved) {
      // Simulate the reassignment in state
      const user = getUserFromSession();
      const targets = _tickets.filter(
        (t) => t.assigned_user_id === user?.id && !t.completed
      ).slice(0, 2);
      const bob = _users.find((u) => u.name.toLowerCase().includes('bob'));
      if (bob) {
        targets.forEach((t) => {
          t.assigned_user_id = bob.id;
          t.assigned_user_name = bob.name;
        });
      }
      return {
        response: `Done! I've reassigned ${targets.map((t) => `"${t.chore_name}"`).join(' and ')} to ${bob?.name ?? 'your roommate'}. They've been notified. 🎉`,
        conversation_id: data.conversation_id,
      };
    } else {
      return {
        response: "No problem! The chore assignments remain unchanged. Is there anything else I can help you with?",
        conversation_id: data.conversation_id,
      };
    }
  },

  getConversations: async () => {
    await sleep(DELAY);
    return Object.entries(_conversations).map(([id, messages]) => ({
      conversation_id: id,
      messages,
      created_at: new Date().toISOString(),
    }));
  },
};

export const notificationsAPI = {
  getNotifications: async () => {
    await sleep(DELAY);
    return [..._notifications];
  },

  markRead: async (notificationId) => {
    await sleep(DELAY / 2);
    const notif = _notifications.find((n) => n.id === notificationId);
    if (notif) notif.is_read = true;
    return { message: 'Marked as read' };
  },

  dismiss: async (notificationId) => {
    await sleep(DELAY / 2);
    _notifications = _notifications.filter((n) => n.id !== notificationId);
    return { message: 'Notification dismissed' };
  },

  sendAppreciation: async (targetUserId, message) => {
    await sleep(DELAY);
    const target = _users.find((u) => u.id === targetUserId);
    const sender = getUserFromSession();
    const newNotif = {
      id: `notif-${Date.now()}`,
      message: `${sender?.name ?? 'Someone'} sent you an appreciation: "${message}" ❤️`,
      is_read: false,
      created_at: new Date().toISOString(),
      type: 'appreciation',
    };
    _notifications.unshift(newNotif);

    // Also fire the mock SSE stream for the target if they have one open
    _mockStreamListeners.forEach((cb) => cb());

    return { message: `Appreciation sent to ${target?.name ?? 'your roommate'}` };
  },

  /**
   * Mock implementation of openStream().
   *
   * Returns a fake EventSource-compatible object that:
   *  - Fires `event: connected` immediately
   *  - Fires `event: new_notification` every VITE_MOCK_SSE_INTERVAL_MS (default 8000ms)
   *    to simulate real push events during load testing
   *  - Supports .addEventListener() and .close()
   */
  openStream: () => {
    const SSE_INTERVAL = Number(import.meta.env.VITE_MOCK_SSE_INTERVAL_MS ?? 8000);

    const listeners = {};
    let closed = false;
    let intervalId = null;

    const mockEs = {
      readyState: 1, // OPEN
      addEventListener(event, cb) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      },
      removeEventListener(event, cb) {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((l) => l !== cb);
        }
      },
      close() {
        closed = true;
        if (intervalId) clearInterval(intervalId);
        // Remove from global listener set
        _mockStreamListeners.delete(fireEvent);
        console.log('[MockSSE] stream closed');
      },
      onerror: null,
      onmessage: null,
      onopen: null,
    };

    const fireEvent = (eventName = 'new_notification') => {
      if (closed) return;
      const handlers = listeners[eventName] || [];
      handlers.forEach((h) => h(new Event(eventName)));
    };

    // Register with global set so sendAppreciation can trigger a push
    _mockStreamListeners.add(fireEvent);

    // Fire connected event asynchronously
    setTimeout(() => fireEvent('connected'), 50);

    // Periodically fire new_notification to simulate server push
    intervalId = setInterval(() => {
      if (!closed) {
        // Add a synthetic notification
        _notifications.unshift({
          id: `notif-mock-${Date.now()}`,
          message: '🔔 Simulated push: new chore activity in your household.',
          is_read: false,
          created_at: new Date().toISOString(),
          type: 'system',
        });
        fireEvent('new_notification');
      }
    }, SSE_INTERVAL);

    console.log(`[MockSSE] stream opened (auto-push every ${SSE_INTERVAL}ms)`);
    return mockEs;
  },
};

/** Default export mirrors api.js default (the raw apiRequest function).
 *  In mock mode, return a no-op that warns in console. */
const mockApiRequest = async (endpoint, options = {}) => {
  console.warn(`[MockAPI] Direct apiRequest call to ${endpoint} — not fully mocked. Returning empty object.`);
  await sleep(DELAY);
  return {};
};

export default mockApiRequest;
