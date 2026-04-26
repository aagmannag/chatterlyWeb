# Chat App Frontend - Complete Guide

Built with **React**, **Vite**, **Tailwind CSS**, **Socket.io**, and **Lucide Icons**

## 📋 Table of Contents

1. [Project Structure](#project-structure)
2. [Installation](#installation)
3. [Running the App](#running-the-app)
4. [Features](#features)
5. [File Structure](#file-structure)
6. [API Integration](#api-integration)
7. [Socket Events](#socket-events)
8. [Troubleshooting](#troubleshooting)

---

## 🏗️ Project Structure

```
client/
├── src/
│   ├── components/          # Reusable components
│   │   ├── ChatList.jsx     # Conversations list
│   │   ├── ChatWindow.jsx   # Active chat window
│   │   └── NavBar.jsx       # Top navigation
│   ├── pages/               # Page components
│   │   ├── Login.jsx        # Login page
│   │   ├── Signup.jsx       # Registration page
│   │   ├── Chat.jsx         # Main chat page
│   │   └── Status.jsx       # Status feed page
│   ├── services/            # API & Socket services
│   │   ├── api.js           # Axios API calls
│   │   ├── socket.js        # Socket.io handlers
│   │   └── authContext.js   # Auth state management
│   ├── utils/               # Helper functions
│   │   └── helpers.js       # Date/time formatting, etc.
│   ├── App.jsx              # Main app component with routing
│   ├── main.jsx             # Entry point
│   └── index.css            # Tailwind CSS
├── index.html               # HTML template
├── vite.config.js           # Vite configuration
└── package.json             # Dependencies

```

---

## 🚀 Installation

### 1. Install Dependencies

```bash
cd client
npm install
```

### 2. Environment Setup

The app connects to `http://localhost:5000` by default. Make sure your backend server is running.

**To change the API URL**, edit `src/services/api.js`:

```javascript
const API = axios.create({
  baseURL: 'http://YOUR_API_URL/api',  // Change this
});
```

---

## ▶️ Running the App

### Development Server

```bash
npm run dev
```

Access at: **http://localhost:5173**

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## ✨ Features

✅ **Authentication**
- User signup with email, password, name
- User login with JWT token
- Persistent login (stored in localStorage)
- Protected routes

✅ **Real-Time Chat**
- Send/receive messages instantly
- View online status of users
- Message timestamps
- Conversation list with last message preview

✅ **Status Feature** (WhatsApp-like)
- Upload images, videos, audio
- View status with auto-delete after 24 hours
- See who viewed your status
- Real-time status notifications

✅ **Voice & Video Calls**
- WebRTC peer-to-peer calls
- ICE/TURN server configuration
- Call initiation notifications
- Disconnect handling

✅ **User Management**
- View all users
- Start new conversations
- Profile with avatar
- Online/offline status

---

## 📂 File Structure Details

### `src/services/api.js`

Centralized API calls using Axios. All endpoints are pre-configured:

```javascript
// Example usage
const { data } = await chatAPI.getConversations();
const { data } = await statusAPI.uploadStatus(file, mediaType, caption);
```

### `src/services/socket.js`

Socket.io connection and event handlers:

```javascript
// Connect to server
const socket = initSocket(token);

// Emit events
socketHandlers.sendMessage(payload);
socketHandlers.broadcastStatus(statusData);

// Listen to events
socket.on('message:receive', (message) => {...});
socket.on('status:new', (status) => {...});
```

### `src/services/authContext.js`

Global auth state using React Context:

```javascript
const { user, token, login, logout, loading } = useContext(AuthContext);
```

### `src/components/`

**ChatList.jsx** - Displays all conversations
- Shows online status
- Last message preview
- Timestamp formatting

**ChatWindow.jsx** - Active conversation view
- Message display with timestamps
- Message input with send button
- User info and call buttons
- Auto-scroll to latest message

**NavBar.jsx** - Top navigation
- Links to Chat and Status pages
- User profile
- Logout button

### `src/pages/`

**Login.jsx** - User login
- Email/password input
- Error handling
- Link to signup

**Signup.jsx** - User registration
- Name/email/password input
- Auto-login after signup
- Link to login

**Chat.jsx** - Main messenger
- Conversation management
- Message handling
- Socket events
- New conversation creation

**Status.jsx** - Status feed
- Upload new status
- View others' statuses
- See viewer count
- Delete own statuses
- Real-time updates

---

## 🔌 API Integration

All API calls use **Axios** with automatic Bearer token injection:

```javascript
// Add token automatically to all requests
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Available Endpoints

```javascript
// Auth
authAPI.signup({ email, password, name })
authAPI.login({ email, password })

// Chat
chatAPI.createConversation(participantId)
chatAPI.getConversations()
chatAPI.getMessages(conversationId)
chatAPI.sendMessage(conversationId, { text, attachments })

// Status
statusAPI.uploadStatus(file, mediaType, caption)
statusAPI.getStatuses()
statusAPI.getMyStatuses()
statusAPI.markAsViewed(statusId)
statusAPI.getViewers(statusId)
statusAPI.deleteStatus(statusId)

// Users
userAPI.getUsers()
userAPI.getUserById(id)
userAPI.uploadAvatar(file)
```

---

## 🔔 Socket Events

### Listen (from server)

```javascript
socket.on('user:online', (data) => {})      // User came online
socket.on('user:offline', (data) => {})     // User went offline
socket.on('message:receive', (msg) => {})   // New message
socket.on('message:status', (data) => {})   // Message status changed
socket.on('status:new', (status) => {})     // New status uploaded
socket.on('status:view-notification', (data) => {})  // Someone viewed your status
socket.on('status:deleted', (data) => {})   // Status was deleted
socket.on('incoming-call', (data) => {})    // Incoming call
socket.on('call-answered', (data) => {})    // Call accepted
socket.on('ice-candidate', (data) => {})    // ICE candidate
socket.on('call-ended', (data) => {})       // Call ended
```

### Emit (to server)

```javascript
socket.emit('join:conversation', { conversationId })
socket.emit('leave:conversation', { conversationId })
socket.emit('message:send', payload)
socket.emit('message:delivered', { conversationId, messageId })
socket.emit('status:upload', statusData)
socket.emit('status:viewed', { statusId, userId, viewerName })
socket.emit('status:delete', { statusId, userId })
socket.emit('call-initiate', { to, conversationId, fromName, callType })
socket.emit('call-user', { to, conversationId, offer, callId })
socket.emit('answer-call', { to, conversationId, answer })
socket.emit('ice-candidate', { to, conversationId, candidate })
socket.emit('end-call', { to, conversationId, reason })
```

---

## 🎨 Styling

Using **Tailwind CSS v4** with utility classes:

- Gradient backgrounds: `bg-gradient-to-r from-blue-500 to-purple-600`
- Responsive design: `hidden lg:block` (mobile-first)
- Transitions: `hover:shadow-lg transition`
- Spacing: `gap-4`, `p-4`, `mb-8`

---

## 📱 Responsive Design

- **Mobile-first approach** with Tailwind breakpoints
- `hidden lg:block` for desktop-only elements
- `fixed` overlays for mobile modals
- Full-width forms on mobile
- Side-by-side layout on desktop (navbar + chat + sidebar)

---

## 🔐 Authentication Flow

```
1. User enters email/password/name
2. Submit to /api/auth/signup or /api/auth/login
3. Backend returns token + user data
4. Store in localStorage
5. Initialize Socket.io with token
6. Redirect to /chat
7. All requests include Authorization header automatically
8. On logout: clear localStorage, disconnect socket, redirect to login
```

---

## 🛠️ Troubleshooting

### Issue: "Failed to connect to API"

**Solution:**
- Check if backend server is running: `npm run dev` in Server folder
- Verify API URL in `src/services/api.js`
- Check CORS configuration on backend

### Issue: "Socket connection refused"

**Solution:**
- Ensure backend is running
- Check Socket.io port (should be 5000)
- Verify auth token is valid

### Issue: "Messages not showing in real-time"

**Solution:**
- Check socket connection in browser console
- Verify conversation ID matches
- Ensure `joinConversation` was called

### Issue: "Status not uploading"

**Solution:**
- Check file size (max 4MB)
- Verify Cloudinary is configured on backend
- Check browser console for error details
- Verify token is valid

### Issue: "Getting 401 Unauthorized"

**Solution:**
- Token has expired - logout and login again
- Token not stored properly in localStorage
- Backend JWT_SECRET doesn't match

---

## 📊 Performance Tips

1. **Lazy load conversations** - Load only when scrolled into view
2. **Pagination for messages** - Don't load all 1000 messages at once
3. **Memoize components** - Use `React.memo` for ChatList items
4. **Debounce typing** - Don't emit every keystroke
5. **Compress images** - Upload resized images to Cloudinary

---

## 🔄 Data Flow

```
User Input
  ↓
Component State Update
  ↓
API Call (axios with token)
  ↓
Backend Processing
  ↓
Response + Socket broadcast
  ↓
Socket listener updates state
  ↓
UI Re-render
```

---

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

Creates optimized build in `dist/` folder.

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Netlify

```bash
npm run build
# Upload dist/ folder to Netlify
```

Update `vite.config.js` for custom domain:

```javascript
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})
```

---

## 📚 Dependencies

- **react** - UI framework
- **react-router-dom** - Client routing
- **axios** - HTTP client
- **socket.io-client** - Real-time communication
- **lucide-react** - Icons
- **tailwindcss** - Styling
- **@tailwindcss/vite** - Tailwind integration

---

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit PR

---

## 📞 Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review backend logs
3. Check browser console for errors
4. Verify environment setup

---

**Happy Chatting! 💬**

