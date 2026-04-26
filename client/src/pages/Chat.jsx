import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, MessageSquarePlus } from 'lucide-react';

import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { chatAPI, userAPI } from '../services/api.js';
import { getSocket, socketHandlers } from '../services/socket.js';
import { AuthContext } from '../services/authContextObject.js';
import {
  initMyE2EE,
  encryptForRecipient,
  decryptEnvelope,
  getRecipientPublicKey,
} from '../services/e2ee.js';

const DELETED_PLACEHOLDER = 'This message was deleted';

const getParticipantId = (participant) => participant?._id || participant?.id || participant;

const upsertById = (items, nextItem) => {
  const existingIndex = items.findIndex((item) => item._id === nextItem._id);
  if (existingIndex === -1) return [nextItem, ...items];
  const copy = [...items];
  copy[existingIndex] = { ...copy[existingIndex], ...nextItem };
  return copy;
};

const getOtherParticipant = (conversation, currentUserId) =>
  conversation?.participants?.find(
    (p) => String(getParticipantId(p)) !== String(currentUserId)
  );

export default function Chat() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const socket = getSocket();
  const currentUserId = user?._id || user?.id;

  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);

  // E2EE private key (CryptoKey) — set after bootstrap
  const myPrivKeyRef = useRef(null);
  // true once initMyE2EE has resolved (success or null)
  const [e2eeReady, setE2eeReady] = useState(false);

  const selectedConversationId = selectedConv?._id;

  const refreshUsers = async () => {
    try {
      const usersRes = await userAPI.getUsers();
      setUsers(usersRes?.data || []);
    } catch (err) {
      console.error('Failed to refresh users:', err);
    }
  };

  const refreshConversations = async () => {
    try {
      const convRes = await chatAPI.getConversations();
      setConversations(convRes?.data || []);
    } catch (err) {
      console.error('Failed to refresh conversations:', err);
    }
  };

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      // Clear E2EE key on logout so the next user starts fresh
      myPrivKeyRef.current = null;
      setE2eeReady(false);
      navigate('/login');
      return;
    }
  }, [user, navigate]);

  // Initialise E2EE private key for this session
  useEffect(() => {
    if (!user) return;
    // Reset readiness flag while we fetch the key
    setE2eeReady(false);
    initMyE2EE(user._id || user.id)
      .then((privKey) => {
        myPrivKeyRef.current = privKey;
        setE2eeReady(true);
      })
      .catch((err) => {
        console.warn('E2EE init failed:', err);
        setE2eeReady(true); // mark ready even on failure so messages still load
      });
  }, [user]);

  // Load conversations & users
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const [convRes, usersRes] = await Promise.all([
          chatAPI.getConversations(),
          userAPI.getUsers(),
        ]);
        setConversations(convRes?.data || []);
        setUsers(usersRes?.data || []);
        if (currentUserId) localStorage.setItem('userId', currentUserId);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    loadData();
  }, [user, currentUserId]);

  // Keep user directory fresh so newly created accounts appear in search
  // without requiring a full page refresh.
  useEffect(() => {
    if (!user) return;

    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshUsers();
      }
    };

    const intervalId = setInterval(refreshIfVisible, 15000);
    window.addEventListener('focus', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [user]);

  // ─── Sent-message plaintext cache ────────────────────────────────────────
  // Sender can't decrypt their own messages (encrypted for recipient).
  // Store plaintext in localStorage so it survives logout/login.
  const SENT_CACHE_KEY = `chatterly_sent_${currentUserId}`;

  const getSentCache = () => {
    try { return JSON.parse(localStorage.getItem(SENT_CACHE_KEY) || '{}'); }
    catch { return {}; }
  };

  const saveSentMsg = (msgId, plaintext) => {
    if (!msgId || !plaintext) return;
    const cache = getSentCache();
    cache[msgId] = plaintext;
    // Keep cache lean — max 500 entries (drop oldest)
    const keys = Object.keys(cache);
    if (keys.length > 500) delete cache[keys[0]];
    localStorage.setItem(SENT_CACHE_KEY, JSON.stringify(cache));
  };

  // Helper: resolve plaintext for a message
  // Priority: 1) server already sent text  2) sent-msg cache  3) RSA decrypt fallback
  const decryptMsg = async (msg) => {
    if (msg.text) return msg; // server decrypted or optimistic — already has text

    // Check sent-message plaintext cache (survives logout/login for sender)
    if (msg._id) {
      const cache = getSentCache();
      if (cache[msg._id]) return { ...msg, text: cache[msg._id] };
    }

    // Last-resort: try RSA decrypt client-side (handles edge cases)
    if (!msg.cipherText || !myPrivKeyRef.current) return msg;
    try {
      const plain = await decryptEnvelope(msg.cipherText, myPrivKeyRef.current);
      return plain ? { ...msg, text: plain } : msg;
    } catch {
      return msg;
    }
  };

  // Load messages whenever conversation is selected OR e2ee key becomes ready
  useEffect(() => {
    if (!selectedConv || !e2eeReady) return;
    const loadMessages = async () => {
      try {
        const res = await chatAPI.getMessages(selectedConv._id);
        const raw = res?.data || [];
        const decrypted = await Promise.all(raw.map(decryptMsg));
        setMessages(decrypted);
        socketHandlers.joinConversation(selectedConv._id);
        socketHandlers.markAllRead(selectedConv._id);
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };
    loadMessages();
    return () => socketHandlers.leaveConversation(selectedConv._id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConv, e2eeReady]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const onOnlineUsersSnapshot = (data) => {
      const ids = Array.isArray(data?.userIds)
        ? data.userIds.map((id) => String(id))
        : [];
      setOnlineUsers(ids.filter((id) => id !== String(currentUserId)));
    };

    const onUserOnline = (data) => {
      const nextId = String(data?.userId || '');
      if (!nextId || nextId === String(currentUserId)) return;
      setOnlineUsers((prev) => [...new Set([...prev.map((id) => String(id)), nextId])]);
    };

    const onUserOffline = (data) => {
      const nextId = String(data?.userId || '');
      if (!nextId) return;
      setOnlineUsers((prev) => prev.map((id) => String(id)).filter((id) => id !== nextId));
    };

    const onIncomingMessage = async (newMessage) => {
      const incomingConversationId =
        newMessage?.conversationId?._id || newMessage?.conversationId;

      if (!incomingConversationId) return;

      // Decrypt if needed before touching state
      const decoded = await (async () => {
        if (newMessage.text) return newMessage;

        // Check sent-message plaintext cache first (handles sender's own messages)
        if (newMessage._id) {
          const cache = getSentCache();
          if (cache[newMessage._id]) return { ...newMessage, text: cache[newMessage._id] };
        }

        if (newMessage.cipherText && myPrivKeyRef.current) {
          const plain = await decryptEnvelope(newMessage.cipherText, myPrivKeyRef.current).catch(() => '');
          return plain ? { ...newMessage, text: plain } : newMessage;
        }
        return newMessage;
      })();

      setConversations((prev) =>
        {
          const exists = prev.some((conv) => String(conv._id) === String(incomingConversationId));
          if (!exists) {
            refreshConversations();
            return prev;
          }

          return prev
            .map((conv) => {
              if (String(conv._id) !== String(incomingConversationId)) return conv;
              return {
                ...conv,
                lastMessage: decoded,
                updatedAt: decoded.createdAt || new Date().toISOString(),
              };
            })
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }
      );

      if (selectedConversationId === incomingConversationId) {
        setMessages((prev) => {
          const existingIndex = prev.findIndex(
            (msg) =>
              (msg._id && msg._id === decoded._id) ||
              (msg.clientId && msg.clientId === decoded.clientId)
          );
          if (existingIndex !== -1) {
            // Already in state — only replace if the incoming version has plaintext
            // (prevents encrypted socket copy from overwriting our optimistic plaintext)
            if (!decoded.text) return prev;
            const copy = [...prev];
            copy[existingIndex] = { ...copy[existingIndex], ...decoded };
            return copy;
          }
          return [...prev, decoded];
        });

        const incomingSenderId =
          decoded?.sender?._id || decoded?.sender?.id || decoded?.senderId;
        if (String(incomingSenderId) !== String(currentUserId)) {
          socketHandlers.markMessageRead(incomingConversationId, decoded._id);
        }
      }
    };

    const onMessageStatus = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId || m._id === data._id
            ? { ...m, status: data.status }
            : m
        )
      );
    };

    // WhatsApp-style "delete for everyone" from any tab/device
    const onMessageDeleted = (data) => {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data._id
            ? { ...m, isDeleted: true, text: DELETED_PLACEHOLDER, cipherText: null }
            : m
        )
      );
    };

    const onNewMessageNotification = (data) => {
      if (data?.message) {
        onIncomingMessage(data.message);
        return;
      }
      refreshConversations();
    };

    socket.on('users:online', onOnlineUsersSnapshot);
    socket.on('user:online', onUserOnline);
    socket.on('user:offline', onUserOffline);
    socket.on('message:receive', onIncomingMessage);
    socket.on('message:new', onIncomingMessage);
    socket.on('notification:new_message', onNewMessageNotification);
    socket.on('message:status', onMessageStatus);
    socket.on('message:deleted', onMessageDeleted);

    return () => {
      socket.off('users:online', onOnlineUsersSnapshot);
      socket.off('user:online', onUserOnline);
      socket.off('user:offline', onUserOffline);
      socket.off('message:receive', onIncomingMessage);
      socket.off('message:new', onIncomingMessage);
      socket.off('notification:new_message', onNewMessageNotification);
      socket.off('message:status', onMessageStatus);
      socket.off('message:deleted', onMessageDeleted);
    };
  }, [socket, selectedConversationId, currentUserId]);

  const handleDeleteMessage = async (messageId) => {
    if (!selectedConv) return;
    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m._id === messageId
          ? { ...m, isDeleted: true, text: DELETED_PLACEHOLDER, cipherText: null }
          : m
      )
    );
    try {
      await chatAPI.deleteMessage(selectedConv._id, messageId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleSendMessage = async ({ text = '', file = null } = {}) => {
    if (!selectedConv || !user) return;
    try {
      const clientId = `${user._id || user.id}-${Date.now()}`;
      const trimmedText = text.trim();

      // Find the other participant's ID to look up their public key
      const other = selectedConv.participants?.find(
        (p) => String(getParticipantId(p)) !== String(currentUserId)
      );
      const otherId = getParticipantId(other);

      let res;
      if (file) {
        // Attachments: send as-is (file encryption is a separate concern)
        const formData = new FormData();
        formData.append('attachment', file);
        formData.append('clientId', clientId);
        if (trimmedText) formData.append('text', trimmedText);
        res = await chatAPI.sendMediaMessage(selectedConv._id, formData);
      } else {
        if (!trimmedText) return;

        let payload;
        // Try to encrypt if we have E2EE ready
        if (otherId && myPrivKeyRef.current) {
          try {
            const recipientPubKeyB64 = await getRecipientPublicKey(otherId);
            const envelope = await encryptForRecipient(recipientPubKeyB64, trimmedText);
            payload = {
              cipherText: envelope,
              contentType: 'client:rsa-aes',
              clientId,
            };
          } catch (e) {
            console.warn('E2EE encrypt failed, sending as plaintext:', e);
            payload = { text: trimmedText, clientId };
          }
        } else {
          // E2EE not ready yet — fall back to server-side encryption
          payload = { text: trimmedText, clientId };
        }

        res = await chatAPI.sendMessage(selectedConv._id, payload);
      }

      const apiMessage = res?.data?.data;
      if (apiMessage) {
        // Persist plaintext for the sender so they can see it after re-login
        if (apiMessage._id && trimmedText) saveSentMsg(apiMessage._id, trimmedText);

        // Optimistic message always shows plaintext immediately
        const normalized = {
          ...apiMessage,
          text: trimmedText || apiMessage.text,
          sender: apiMessage.sender?._id ? apiMessage.sender : user,
        };
        setMessages((prev) => {
          const existingIndex = prev.findIndex(
            (msg) =>
              msg._id === normalized._id ||
              (normalized.clientId && msg.clientId === normalized.clientId)
          );
          if (existingIndex !== -1) {
            // Socket may have already added the encrypted version — replace it with plaintext
            const copy = [...prev];
            copy[existingIndex] = { ...copy[existingIndex], ...normalized };
            return copy;
          }
          return [...prev, normalized];
        });
        setConversations((prev) =>
          prev
            .map((conv) =>
              conv._id === selectedConv._id
                ? {
                    ...conv,
                    lastMessage: normalized,
                    updatedAt: normalized.createdAt || new Date().toISOString(),
                  }
                : conv
            )
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleStartChat = async (newUser) => {
    try {
      const res = await chatAPI.createConversation(newUser._id);
      const newConv = res?.data;
      setConversations((prev) => upsertById(prev, newConv));
      setSelectedConv(newConv);
      setShowUserList(false);
      setUserSearch('');
      setMessages([]);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const contacts = conversations
    .filter((conv) => Boolean(conv?.lastMessage))
    .map((conv) => {
      const other = getOtherParticipant(conv, currentUserId);
      if (!other) return null;
      return {
        user: other,
        conversation: conv,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.conversation?.updatedAt || 0;
      const bTime = b.conversation?.updatedAt || 0;
      return new Date(bTime) - new Date(aTime);
    });

  const existingConversationUserIds = new Set(
    contacts.map((entry) => String(entry.user?._id))
  );

  const searchableUsers = users.filter(
    (u) => !existingConversationUserIds.has(String(u._id))
  );

  const filteredUsers = users.filter((u) =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="flex h-screen lg:h-[calc(100vh-80px)] lg:mt-20 pb-16 lg:pb-0 bg-[#0f0f13] overflow-hidden">

      {/* ── Sidebar ── */}
      <div className={`${showMobileList ? 'flex' : 'hidden'} lg:flex w-full lg:w-auto min-w-0`}>
        <ChatList
          contacts={contacts}
          searchableUsers={searchableUsers}
          selectedId={selectedConv?._id}
          onSelect={(conversationOrContact) => {
            if (conversationOrContact?.conversation) {
              setSelectedConv(conversationOrContact.conversation);
              setShowMobileList(false);
              return;
            }
            if (conversationOrContact?.participants) {
              setSelectedConv(conversationOrContact);
              setShowMobileList(false);
              return;
            }
            if (conversationOrContact?._id) {
              handleStartChat(conversationOrContact);
              setShowMobileList(false);
            }
          }}
          onlineUsers={onlineUsers}
          onNewChat={() => setShowUserList(true)}
        />
      </div>

      {/* ── Main ── */}
      <div className={`${showMobileList ? 'hidden' : 'flex'} lg:flex flex-1 flex-col min-w-0`}>
        <ChatWindow
          conversation={selectedConv}
          messages={messages}
          onSendMessage={handleSendMessage}
          onlineUsers={onlineUsers}
          socket={socket}
          onBack={() => setShowMobileList(true)}
          showBackButton={!showMobileList}
        />
      </div>

      {/* ── New Chat Modal ── */}
      {showUserList && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowUserList(false)}
        >
          <div className="bg-[#13131a] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            style={{ animation: 'modalIn 0.2s ease both' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-sm font-semibold text-white/80">New Conversation</h2>
              <button
                onClick={() => setShowUserList(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
              >
                <X size={15} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-white/[0.04]">
              <div className="relative flex items-center">
                <Search className="absolute left-3 text-white/25 pointer-events-none" size={14} />
                <input
                  type="text"
                  placeholder="Search people..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/[0.07] rounded-xl
                    text-xs text-white/70 placeholder-white/25 outline-none
                    focus:border-indigo-400/30 focus:ring-1 focus:ring-indigo-500/10 transition-all"
                  autoFocus
                />
              </div>
            </div>

            {/* User List */}
            <div className="max-h-72 overflow-y-auto py-1 scrollbar-thin scrollbar-thumb-white/[0.06] scrollbar-track-transparent">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-xs text-white/25 py-8">No users found</p>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => handleStartChat(u)}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors group"
                  >
                    <img
                      src={
                        u.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=6366f1&color=fff&bold=true`
                      }
                      alt={u.name}
                      className="w-8 h-8 rounded-full object-cover border border-white/10 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/75 truncate group-hover:text-white/90 transition-colors">
                        {u.name}
                      </p>
                      {u.email && (
                        <p className="text-[11px] text-white/25 truncate">{u.email}</p>
                      )}
                    </div>
                    {onlineUsers.includes(u._id) && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.96) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}