# Complete Chat App Setup & Testing Guide

## 🎯 Quick Start

### 1. Start Backend Server

```bash
cd Server/Server
npm install  # If not already done
npm run dev
```

**Expected output:**
```
✅ Server listening on http://localhost:5000
📍 Registering API routes...
```

---

### 2. Start Frontend Dev Server

In a **new terminal**:

```bash
cd Server/client
npm run dev
```

**Expected output:**
```
VITE v7.3.1 ready in 1000ms
➜  Local: http://localhost:5173/
```

---

### 3. Open in Browser

Visit: **http://localhost:5173**

---

## 🔐 Test Authentication

### Signup

1. Click "Sign up" link
2. Enter:
   - **Name**: John Doe
   - **Email**: john@example.com
   - **Password**: password123
3. Click "Sign Up"
4. Auto-redirected to Chat page ✅

### Login

1. Click "Login" or go to http://localhost:5173/login
2. Enter credentials from signup
3. Click "Login" ✅

---

## 💬 Test Chat Features

### Create First Conversation

1. In Chat page, click **"+ Start New Chat"**
2. Signup as **second user** first:
   - Email: alice@example.com
   - Name: Alice
   - Password: pass123
3. Login back as John
4. Click **"+ Start New Chat"**
5. Select **Alice** from user list
6. Conversation created ✅

### Send Messages

1. With John logged in, click on Alice's conversation
2. Type message: "Hi Alice!"
3. Press Send or click send button
4. Message appears ✅

### Test Real-Time Messages

1. Open **second browser** or **incognito window**
2. Login as Alice
3. Go to Chat
4. Open John's conversation
5. John sends message → Alice sees it **instantly** ✅

---

## 📸 Test Status Feature

### Upload Status

1. Go to **Status page** (top navigation)
2. Click **"Add Status"**
3. Select an image/video file
4. Add caption (optional): "My awesome status!"
5. Click **"Upload"** ✅

### View Your Status

1. Status appears in **"My Statuses"** section
2. Hover to see **viewer count** and **delete button** ✅

### View Others' Statuses

1. Login as **another user** (e.g., Alice)
2. Upload a status
3. Go back to John's browser
4. Refresh Status page
5. See Alice's status in **"Friends' Statuses"** ✅

### Mark Status as Viewed

1. Click on Alice's status
2. Backend marks as viewed
3. Alice sees **viewer count increase** ✅

---

## 📱 Test Online Status

### See Who's Online

1. Open **2 browsers** side-by-side
2. Login as John in Browser 1
3. Login as Alice in Browser 2
4. In Chat, check conversation
5. Alice shows **🟢 Online** status ✅

### See Who's Offline

1. Close Browser 2
2. In Browser 1, Alice shows **⚫ Offline** ✅

---

## 🔊 Test Voice/Video Calls (Browser Console)

### Setup

1. Open 2 browsers with different users logged in
2. Create conversation between them (both see it)
3. In **each browser**, open **DevTools** (F12)
4. Go to **Console tab**

### Test Call Initiation (Window 1 - User A)

Paste into console:

```javascript
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});

socket.on('connect', () => console.log('✅ Connected'));
socket.on('incoming-call', (data) => console.log('📞 Incoming call:', data));
socket.on('call-answered', (data) => console.log('✅ Call answered:', data));
socket.on('ice-candidate', (data) => console.log('🧊 ICE candidate:', data));
```

### Test Call from Window 1 - User A

```javascript
socket.emit('call-initiate', {
  to: 'user_b_id',  // Replace with actual User B ID
  conversationId: 'conv_id',  // Replace with actual conversation ID
  fromName: 'John',
  callType: 'audio'
});
```

**Expected in Window 2 console:**
```
📞 Incoming call: { from: "user_a_id", callType: "audio", ... }
```

---

## ✅ Feature Checklist

### Authentication
- [ ] Signup works
- [ ] Login works
- [ ] Logout works
- [ ] Protected routes work
- [ ] Token persists on refresh

### Chat
- [ ] Create conversation with another user
- [ ] Send messages
- [ ] Receive messages in real-time
- [ ] See online status
- [ ] See conversation list

### Status
- [ ] Upload image status
- [ ] Upload video status
- [ ] View own statuses
- [ ] View others' statuses
- [ ] See viewer count
- [ ] Delete own status
- [ ] Real-time status updates

### Calls (Technical Test)
- [ ] Call initiation notification shows
- [ ] WebRTC offer/answer exchanged
- [ ] ICE candidates flow
- [ ] Call can be ended

### UI/UX
- [ ] Responsive on mobile
- [ ] Works on desktop
- [ ] Smooth animations
- [ ] Proper error messages
- [ ] Loading states work

---

## 🐛 Common Issues & Solutions

### Issue: "Cannot GET /api/chat/conversations"

**Solution:**
- Backend not running
- API URL is wrong in `src/services/api.js`
- Backend changes haven't been saved

**Fix:**
```bash
cd Server/Server
npm run dev
```

---

### Issue: "Socket connection refused"

**Solution:**
- Backend not running on port 5000
- Firewall blocking connections
- Wrong auth token

**Fix:**
```javascript
// Verify socket is connecting
const socket = io('http://localhost:5000', {
  auth: { token: localStorage.getItem('token') }
});
socket.on('connect', () => console.log('Connected!'));
socket.on('connect_error', (err) => console.error('Error:', err));
```

---

### Issue: "Messages not syncing between windows"

**Solution:**
- Not in same conversation
- Socket listeners not set up
- Conversation ID doesn't match

**Fix:**
```javascript
// Check if socket is listening
socket.on('message:receive', (msg) => console.log('New message:', msg));
```

---

### Issue: "Status not uploading"

**Solution:**
- Cloudinary not configured on backend
- File too large
- Wrong Cloudinary credentials

**Fix:**
- Check `.env` file in Server folder
- Verify `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET`

---

### Issue: "401 Unauthorized on every request"

**Solution:**
- Token expired
- Token not saved in localStorage
- Backend JWT_SECRET changed

**Fix:**
```javascript
// Clear storage and login again
localStorage.clear();
// Or check token
console.log(localStorage.getItem('token'));
```

---

## 📊 Project Files Created

```
✅ 7 Pages:
   - Login.jsx
   - Signup.jsx
   - Chat.jsx
   - Status.jsx

✅ 3 Components:
   - ChatList.jsx
   - ChatWindow.jsx
   - NavBar.jsx

✅ 3 Services:
   - api.js (Axios client)
   - socket.js (Socket.io)
   - authContext.js (State management)

✅ 1 Utils:
   - helpers.js (Date/time formatting)

✅ 2 Config:
   - App.jsx (Routing)
   - main.jsx (Entry point)
```

---

## 🚀 Deployment Checklist

- [ ] Backend API URL updated for production
- [ ] Socket URL updated for production
- [ ] Cloudinary credentials verified
- [ ] JWT_SECRET is strong and secure
- [ ] CORS properly configured
- [ ] Environment variables set up
- [ ] SSL/HTTPS enabled
- [ ] Build optimized: `npm run build`
- [ ] Test in production URL
- [ ] Monitor for errors

---

## 📈 Performance Monitors

Open DevTools (F12) and check:

**Network Tab:**
- All requests complete successfully
- No 404 or 500 errors
- Response times < 500ms

**Console Tab:**
- No red JS errors
- Socket connection shows ✅

**Application Tab:**
- Token visible in localStorage
- User data visible in localStorage

---

## 🔗 API Endpoints Quick Reference

```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/users
POST   /api/chat/conversations
GET    /api/chat/conversations
GET    /api/chat/conversations/:id/messages
POST   /api/chat/conversations/:id/messages
GET    /api/status
POST   /api/status/upload
GET    /api/status/my-statuses
POST   /api/status/:id/view
GET    /api/status/:id/viewers
DELETE /api/status/:id
```

---

## 🎯 Next Steps

1. **Test all features** using the checklist above
2. **Fix any bugs** found during testing
3. **Optimize performance** if needed
4. **Deploy to production** (Vercel, Netlify, or custom server)
5. **Monitor in production** for errors

---

## 📞 Support

If you encounter any issues:

1. Check the **Troubleshooting** section
2. Review **Terminal output** for errors
3. Check **Browser Console** for JS errors
4. Check **Network Tab** for API failures
5. Review **Backend logs** for issues

---

**Ready to Chat! 💬✨**

