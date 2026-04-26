import io from 'socket.io-client';

let socket = null;

export const initSocket = (token) => {
  const socketUrl = import.meta.env.VITE_SOCKET_URL;
  socket = io(socketUrl, {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✅ Socket connected:', socket.id);
  });

  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Socket event handlers
export const socketHandlers = {
  // Conversation join/leave
  joinConversation: (conversationId) => {
    if (socket) socket.emit('join:conversation', { conversationId });
  },
  leaveConversation: (conversationId) => {
    if (socket) socket.emit('leave:conversation', { conversationId });
  },

  // Messages
  sendMessage: (payload) => {
    if (socket) socket.emit('message:send', payload);
  },
  markMessageDelivered: (conversationId, messageId) => {
    if (socket) socket.emit('message:delivered', { conversationId, messageId });
  },
  markMessageRead: (conversationId, messageId) => {
    if (socket) socket.emit('message:read', { conversationId, messageId });
  },
  markAllRead: (conversationId) => {
    if (socket) socket.emit('messages:markRead', { conversationId });
  },

  // Status
  broadcastStatus: (statusData) => {
    if (socket) socket.emit('status:upload', statusData);
  },
  markStatusViewed: (statusId, statusOwnerId, viewerName) => {
    if (socket)
      socket.emit('status:viewed', { statusId, userId: statusOwnerId, viewerName });
  },
  deleteStatus: (statusId, userId) => {
    if (socket) socket.emit('status:delete', { statusId, userId });
  },

  // WebRTC Calls
  initiateCall: (to, conversationId, fromName, callType) => {
    if (socket)
      socket.emit('call-initiate', { to, conversationId, fromName, callType });
  },
  callUser: (to, conversationId, offer, callId) => {
    if (socket) socket.emit('call-user', { to, conversationId, offer, callId });
  },
  answerCall: (to, conversationId, answer) => {
    if (socket) socket.emit('answer-call', { to, conversationId, answer });
  },
  sendIceCandidate: (to, conversationId, candidate) => {
    if (socket)
      socket.emit('ice-candidate', { to, conversationId, candidate });
  },
  endCall: (to, conversationId, reason) => {
    if (socket) socket.emit('end-call', { to, conversationId, reason });
  },
  declineCall: (to, conversationId, reason) => {
    if (socket) socket.emit('call-decline', { to, conversationId, reason });
  },
};