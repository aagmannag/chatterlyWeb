import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://chatterly-backend-f9j0.onrender.com/api',
});

// Attach JWT to every request
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => API.post('/auth/signup', data),
  login: (data) => API.post('/auth/login', data),
  // Validate stored token and return fresh user data
  me: () => API.get('/auth/me'),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const userAPI = {
  getUsers: () => API.get('/users'),
  getUserById: (id) => API.get(`/users/${id}`),
  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return API.post('/users/upload-avatar', formData);
  },
  updateProfile: (data) => API.put('/users/profile', data), // { name?, bio? }
  // WhatsApp-style alias
  updateMyProfile: (data) => API.put('/users/profile', data),
};

// ─── Chat ────────────────────────────────────────────────────────────────────
export const chatAPI = {
  createConversation: (participantId) =>
    API.post('/chat/conversations', { participantId }),
  getConversations: () => API.get('/chat/conversations'),
  getMessages: (conversationId) =>
    API.get(`/chat/conversations/${conversationId}/messages`),
  sendMessage: (conversationId, payload) =>
    API.post(`/chat/conversations/${conversationId}/messages`, payload),
  sendMediaMessage: (conversationId, formData) =>
    API.post(`/chat/conversations/${conversationId}/messages`, formData),
  deleteMessage: (conversationId, messageId) =>
    API.delete(`/chat/conversations/${conversationId}/messages/${messageId}`),

  // WhatsApp-style aliases
  startChat: (participantId) => API.post('/chat/conversations', { participantId }),
  getChats: () => API.get('/chat/conversations'),
  getChatMessages: (conversationId) =>
    API.get(`/chat/conversations/${conversationId}/messages`),
  sendTextMessage: (conversationId, payload) =>
    API.post(`/chat/conversations/${conversationId}/messages`, payload),
  sendAttachment: (conversationId, formData) =>
    API.post(`/chat/conversations/${conversationId}/messages`, formData),
  deleteForEveryone: (conversationId, messageId) =>
    API.delete(`/chat/conversations/${conversationId}/messages/${messageId}`),
};

// ─── Keys / E2EE ─────────────────────────────────────────────────────────────
export const keyAPI = {
  bootstrap: () => API.post('/keys/me/bootstrap'),
  getBundle: (recipientId) => API.get(`/keys/${recipientId}/bundle`),
  updateMyBundle: (data) => API.put('/keys/me/bundle', data),
  uploadOneTimePreKeys: (data) => API.post('/keys/me/prekeys', data),
  getMyPreKeyStatus: () => API.get('/keys/me/prekeys/status'),
};

// ─── Status ──────────────────────────────────────────────────────────────────
export const statusAPI = {
  uploadStatus: (file, mediaType, caption) => {
    const formData = new FormData();
    formData.append('media', file);
    formData.append('mediaType', mediaType);
    formData.append('caption', caption || '');
    return API.post('/status/upload', formData);
  },
  getStatuses: () => API.get('/status'),
  getMyStatuses: () => API.get('/status/my-statuses'),
  markAsViewed: (statusId) => API.post(`/status/${statusId}/view`),
  getViewers: (statusId) => API.get(`/status/${statusId}/viewers`),
  deleteStatus: (statusId) => API.delete(`/status/${statusId}`),

  // WhatsApp-style aliases
  postUpdate: (file, mediaType, caption) => {
    const formData = new FormData();
    formData.append('media', file);
    formData.append('mediaType', mediaType);
    formData.append('caption', caption || '');
    return API.post('/status/upload', formData);
  },
  getRecentUpdates: () => API.get('/status'),
  getMyUpdates: () => API.get('/status/my-statuses'),
  markUpdateViewed: (statusId) => API.post(`/status/${statusId}/view`),
  getUpdateViewers: (statusId) => API.get(`/status/${statusId}/viewers`),
  deleteUpdate: (statusId) => API.delete(`/status/${statusId}`),
};

export default API;
