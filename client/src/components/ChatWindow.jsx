import { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Send,
  Phone,
  Video,
  Paperclip,
  MoreVertical,
  Smile,
  PhoneOff,
  Mic,
  MicOff,
  VideoOff,
  User,
} from 'lucide-react';
import { formatTime, getReadableMessageText } from '../utils/helpers.jsx';
import { AuthContext } from '../services/authContextObject.js';
import { socketHandlers } from '../services/socket.js';

const defaultIceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const quickEmojis = [
  '😀',
  '😂',
  '😍',
  '😎',
  '😭',
  '😡',
  '👍',
  '🙏',
  '🔥',
  '❤️',
  '🎉',
  '😴',
  '🤝',
  '👏',
  '💯',
  '🚀',
  '😅',
  '🥳',
  '🤔',
  '🙌',
];

const formatBytes = (bytes) => {
  if (!bytes || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getMediaKind = (mimeType, url, fileName) => {
  const normalizedMime = (mimeType || '').toLowerCase();
  if (normalizedMime.startsWith('image/')) return 'image';
  if (normalizedMime.startsWith('video/')) return 'video';

  const raw = `${url || ''} ${fileName || ''}`.toLowerCase();
  const clean = raw.split('?')[0].split('#')[0];

  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(clean)) return 'image';
  if (/\.(mp4|webm|mov|m4v|avi|mkv)$/.test(clean)) return 'video';

  return 'file';
};

const getSenderId = (message) => {
  if (!message) return null;
  if (typeof message.sender === 'string') return message.sender;
  return (
    message.sender?._id ||
    message.sender?.id ||
    message.senderId ||
    null
  );
};

const getParticipantId = (participant) =>
  participant?._id || participant?.id || participant;

const getCallTypeFromOffer = (offer) => {
  const sdp = offer?.sdp || '';
  return sdp.includes('m=video') ? 'video' : 'voice';
};

const formatCallDuration = (startedAt) => {
  if (!startedAt) return '00:00';
  const seconds = Math.floor((Date.now() - startedAt) / 1000);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

export default function ChatWindow({
  conversation,
  messages,
  onSendMessage,
  onlineUsers,
  socket,
  onBack,
  showBackButton = false,
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [callState, setCallState] = useState('idle');
  const [callType, setCallType] = useState('voice');
  const [pendingIncoming, setPendingIncoming] = useState(null);
  const [callError, setCallError] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [callDuration, setCallDuration] = useState('00:00');

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);

  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id || localStorage.getItem('userId');

  const otherUser = useMemo(
    () =>
      conversation?.participants?.find(
        (p) => String(getParticipantId(p)) !== String(currentUserId)
      ),
    [conversation, currentUserId]
  );

  const otherUserId = getParticipantId(otherUser);
  const isOnline = (onlineUsers || []).some(
    (id) => String(id) === String(otherUserId)
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleOutsideClick = (event) => {
      const target = event.target;
      if (emojiPickerRef.current?.contains(target) || emojiButtonRef.current?.contains(target)) {
        return;
      }
      setShowEmojiPicker(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [showEmojiPicker]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
    remoteStreamRef.current = remoteStream;
  }, [remoteStream]);

  const cleanupCallMedia = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }

    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      setRemoteStream(null);
    }

    setIsMuted(false);
    setIsCameraOff(false);
    setPendingIncoming(null);
    setCallStartedAt(null);
    setCallDuration('00:00');
  }, []);

  useEffect(() => {
    if (callState !== 'in-call' || !callStartedAt) {
      setCallDuration('00:00');
      return;
    }

    setCallDuration(formatCallDuration(callStartedAt));
    const timer = setInterval(() => {
      setCallDuration(formatCallDuration(callStartedAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [callState, callStartedAt]);

  useEffect(() => {
    return () => cleanupCallMedia();
  }, [cleanupCallMedia]);

  useEffect(() => {
    cleanupCallMedia();
    setCallState('idle');
    setCallError('');
  }, [conversation?._id, cleanupCallMedia]);

  const createPeerConnection = (iceServers) => {
    const pc = new RTCPeerConnection({
      iceServers: iceServers?.length ? iceServers : defaultIceServers,
    });

    pc.onicecandidate = (event) => {
      if (!event.candidate || !otherUser?._id || !conversation?._id) return;
      socketHandlers.sendIceCandidate(otherUser._id, conversation._id, event.candidate);
    };

    pc.ontrack = (event) => {
      if (!event.streams || !event.streams[0]) return;
      setRemoteStream(event.streams[0]);
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const requestLocalMedia = async (mode) => {
    const constraints = {
      audio: true,
      video: mode === 'video',
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    setLocalStream(stream);
    return stream;
  };

  const startCall = async (mode) => {
    if (!conversation?._id || !otherUser?._id || !socket) return;

    try {
      setCallError('');
      setCallType(mode);
      setCallState('outgoing');

      socketHandlers.initiateCall(
        otherUser._id,
        conversation._id,
        user?.name || 'Unknown',
        mode
      );

      const stream = await requestLocalMedia(mode);
      const pc = createPeerConnection(defaultIceServers);

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketHandlers.callUser(otherUser._id, conversation._id, offer, `call-${Date.now()}`);
    } catch (error) {
      console.error('Failed to start call:', error);
      setCallError('Could not start call. Check microphone/camera permissions.');
      cleanupCallMedia();
      setCallState('idle');
    }
  };

  const acceptIncomingCall = async () => {
    if (!pendingIncoming || !conversation?._id || !otherUser?._id) return;

    try {
      setCallError('');
      setCallType(pendingIncoming.callType || 'voice');
      const stream = await requestLocalMedia(pendingIncoming.callType || 'voice');

      const pc = createPeerConnection(pendingIncoming.iceServers || defaultIceServers);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      if (pendingIncoming.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingIncoming.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketHandlers.answerCall(
          pendingIncoming.from,
          pendingIncoming.conversationId,
          answer
        );
      }

      setCallState('in-call');
      setCallStartedAt(Date.now());
      setPendingIncoming(null);
    } catch (error) {
      console.error('Failed to accept call:', error);
      setCallError('Could not accept call. Please retry.');
      cleanupCallMedia();
      setCallState('idle');
    }
  };

  const declineIncomingCall = () => {
    if (!pendingIncoming) return;

    socketHandlers.declineCall(
      pendingIncoming.from,
      pendingIncoming.conversationId,
      'declined'
    );

    setPendingIncoming(null);
    setCallState('idle');
  };

  const endActiveCall = () => {
    if (conversation?._id && otherUser?._id) {
      socketHandlers.endCall(otherUser._id, conversation._id, 'ended');
    }

    cleanupCallMedia();
    setCallState('idle');
  };

  const toggleMute = () => {
    if (!localStream) return;
    const nextValue = !isMuted;
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = !nextValue;
    });
    setIsMuted(nextValue);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    const nextValue = !isCameraOff;
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = !nextValue;
    });
    setIsCameraOff(nextValue);
  };

  useEffect(() => {
    if (!socket || !conversation?._id || !otherUser?._id) return;

    const onIncomingCall = (payload) => {
      if (payload?.conversationId !== conversation._id) return;

      setPendingIncoming({
        ...payload,
        callType: payload.callType || getCallTypeFromOffer(payload.offer),
      });
      setCallType(payload.callType || getCallTypeFromOffer(payload.offer));
      setCallState('incoming');
      setCallError('');
    };

    const onCallAnswered = async (payload) => {
      if (payload?.conversationId !== conversation._id) return;

      try {
        if (!peerConnectionRef.current || !payload.answer) return;
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );
        setCallState('in-call');
        setCallStartedAt(Date.now());
      } catch (error) {
        console.error('Failed to set remote answer:', error);
        setCallError('Connection failed while establishing the call.');
        cleanupCallMedia();
        setCallState('idle');
      }
    };

    const onIceCandidate = async (payload) => {
      if (payload?.conversationId !== conversation._id) return;

      try {
        if (!peerConnectionRef.current || !payload.candidate) return;
        await peerConnectionRef.current.addIceCandidate(
          new RTCIceCandidate(payload.candidate)
        );
      } catch (error) {
        console.error('Failed to add ICE candidate:', error);
      }
    };

    const onCallEnded = (payload) => {
      if (payload?.conversationId !== conversation._id) return;
      cleanupCallMedia();
      setCallState('idle');
    };

    const onCallDeclined = (payload) => {
      if (payload?.conversationId !== conversation._id) return;
      cleanupCallMedia();
      setCallState('idle');
      setCallError('Call was declined.');
    };

    const onCallError = (payload) => {
      setCallError(payload?.message || 'Call failed due to a socket error.');
      cleanupCallMedia();
      setCallState('idle');
    };

    const onCalleeOffline = () => {
      setCallError('User is offline right now.');
      cleanupCallMedia();
      setCallState('idle');
    };

    const onCallBusy = (payload) => {
      if (payload?.conversationId !== conversation._id) return;
      setCallError('User is already in another call.');
      cleanupCallMedia();
      setCallState('idle');
    };

    socket.on('incoming-call', onIncomingCall);
    socket.on('call-answered', onCallAnswered);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('call-ended', onCallEnded);
    socket.on('call-declined', onCallDeclined);
    socket.on('call:error', onCallError);
    socket.on('callee-offline', onCalleeOffline);
    socket.on('call:busy', onCallBusy);

    return () => {
      socket.off('incoming-call', onIncomingCall);
      socket.off('call-answered', onCallAnswered);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('call-ended', onCallEnded);
      socket.off('call-declined', onCallDeclined);
      socket.off('call:error', onCallError);
      socket.off('callee-offline', onCalleeOffline);
      socket.off('call:busy', onCallBusy);
    };
  }, [conversation?._id, otherUser?._id, socket, cleanupCallMedia]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      await onSendMessage({ text: message.trim() });
      setMessage('');
      setShowEmojiPicker(false);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleFilePick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setSending(true);
    try {
      await onSendMessage({ text: message.trim(), file });
      setMessage('');
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Failed to send attachment:', error);
    } finally {
      setSending(false);
    }
  };

  const appendEmoji = (emoji) => {
    setMessage((prev) => `${prev}${emoji}`);
  };

  if (!conversation) {
    return (
      <div className="flex-1 bg-[#e5ddd5] bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.35),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(9,167,121,0.08),transparent_35%)] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-20 h-20 rounded-3xl mx-auto mb-5 bg-white/70 border border-black/5 flex items-center justify-center shadow-sm">
            <span className="text-3xl">💬</span>
          </div>
          <h3 className="text-3xl font-bold text-[#1f2c33] mb-2">Welcome to Chat</h3>
          <p className="text-[#667781] text-base">
            Open any contact from the left side to start real-time messaging, calls, and status sharing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 bg-[#e5ddd5] flex flex-col h-full overflow-hidden">
      <div className="bg-[#f0f2f5] border-b border-black/10 px-3 py-3 md:p-3.5 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          {showBackButton && (
            <button
              onClick={onBack}
              className="lg:hidden p-2 -ml-1 hover:bg-black/5 rounded-full transition text-[#54656f]"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div className="relative flex-shrink-0">
            <img
              src={
                otherUser?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || '?')}&background=25D366&color=fff`
              }
              alt={otherUser?.name}
              className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover"
            />
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] rounded-full border-2 border-[#f0f2f5]" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[#111b21] text-sm truncate">{otherUser?.name}</h3>
            <p className="text-xs text-[#667781]">{isOnline ? 'Online' : 'Offline'}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1">
          <button
            onClick={() => startCall('voice')}
            disabled={callState === 'outgoing' || callState === 'in-call'}
            className="p-2 md:p-2.5 hover:bg-black/5 rounded-full transition text-[#54656f] disabled:opacity-40"
            title="Voice Call"
          >
            <Phone size={18} />
          </button>
          <button
            onClick={() => startCall('video')}
            disabled={callState === 'outgoing' || callState === 'in-call'}
            className="p-2 md:p-2.5 hover:bg-black/5 rounded-full transition text-[#54656f] disabled:opacity-40"
            title="Video Call"
          >
            <Video size={18} />
          </button>
          <button
            className="p-2 md:p-2.5 hover:bg-black/5 rounded-full transition text-[#54656f]"
            title="More Options"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </div>

      {callError && (
        <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs">
          {callError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 md:px-4 py-4 md:py-6 space-y-3 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22 viewBox=%220 0 40 40%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%23d4d9dd%22 fill-opacity=%220.35%22%3E%3Cpath d=%22M20 20c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5 5-2.24 5-5zM40 20c0-2.76-2.24-5-5-5s-5 2.24-5 5 2.24 5 5 5 5-2.24 5-5zM20 40c0-2.76-2.24-5-5-5s-5 2.24-5 5h10zM40 40c0-2.76-2.24-5-5-5s-5 2.24-5 5h10z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]">
        {messages.length === 0 ? (
          <div className="text-center text-[#667781] mt-16">
            <div className="text-5xl mb-3 opacity-70">💬</div>
            <p className="font-medium">No messages yet</p>
            <p className="text-sm">Say hello to start this conversation</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isOwnMessage = String(getSenderId(msg)) === String(currentUserId);
            const msgStatus = isOwnMessage ? msg.status || 'sent' : null;
            const readableText = getReadableMessageText(msg);
            const attachmentUrl = msg?.attachmentUrl || msg?.attachments?.[0] || '';
            const attachmentMime = msg?.attachmentMime || '';
            const attachmentName = msg?.attachmentOriginalName || 'Attachment';
            const fileSize = formatBytes(msg?.attachmentBytes);
            const mediaKind = getMediaKind(attachmentMime, attachmentUrl, attachmentName);
            const isImage = mediaKind === 'image';
            const isVideo = mediaKind === 'video';

            return (
              <div
                key={msg._id || msg.clientId || idx}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div className="flex flex-col max-w-[85%] sm:max-w-xs lg:max-w-md">
                  <div
                    className={`px-3.5 py-2.5 rounded-lg shadow-sm border ${
                      isOwnMessage
                        ? 'bg-[#d9fdd3] text-[#111b21] border-[#c6e9bf] rounded-br-sm'
                        : 'bg-white text-[#111b21] border-black/5 rounded-bl-sm'
                    }`}
                  >
                    {attachmentUrl && (
                      <div className="mb-2">
                        {isImage && (
                          <a href={attachmentUrl} target="_blank" rel="noreferrer" className="block">
                            <img
                              src={attachmentUrl}
                              alt={attachmentName}
                              className="max-h-64 w-full rounded-md object-cover border border-black/10"
                            />
                          </a>
                        )}

                        {isVideo && (
                          <video controls className="max-h-64 w-full rounded-md border border-black/10 bg-black">
                            <source src={attachmentUrl} type={attachmentMime || undefined} />
                            Your browser does not support the video tag.
                          </video>
                        )}

                        {!isImage && !isVideo && (
                          <a
                            href={attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between gap-3 rounded-md border border-black/10 bg-black/5 px-3 py-2 text-sm hover:bg-black/10 transition"
                          >
                            <span className="truncate">{attachmentName}</span>
                            <span className="text-xs text-[#667781]">{fileSize || 'File'}</span>
                          </a>
                        )}
                      </div>
                    )}

                    {readableText && (
                      <p className="break-words leading-relaxed text-sm">{readableText}</p>
                    )}

                    {!readableText && !attachmentUrl && (
                      <p className="break-words leading-relaxed text-sm">Encrypted message</p>
                    )}
                  </div>
                  <p className="text-[11px] mt-1 px-1 text-[#667781] flex items-center gap-1 justify-end">
                    <span>{formatTime(msg.createdAt)}</span>
                    {msgStatus && <span className="uppercase tracking-wide">{msgStatus}</span>}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative bg-[#f0f2f5] border-t border-black/10 p-2.5 md:p-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFilePick}
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.rar,.xlsx,.ppt,.pptx"
        />

        {showEmojiPicker && (
          <div
            ref={emojiPickerRef}
            className="absolute bottom-[calc(100%+8px)] left-14 w-72 rounded-xl border border-black/10 bg-white p-3 shadow-xl z-20"
          >
            <div className="grid grid-cols-10 gap-1.5">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => appendEmoji(emoji)}
                  className="h-8 w-8 rounded-md hover:bg-black/5 transition text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button
            type="button"
            className="p-2.5 hover:bg-black/5 rounded-full transition text-[#54656f]"
            title="Attach file"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
          >
            <Paperclip size={19} />
          </button>
          <button
            ref={emojiButtonRef}
            type="button"
            className="p-2.5 hover:bg-black/5 rounded-full transition text-[#54656f]"
            title="Emoji"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            disabled={sending}
          >
            <Smile size={19} />
          </button>
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message"
            disabled={sending}
            className="flex-1 bg-white border border-black/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25d366]/40"
          />
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className={`p-2.5 rounded-full transition ${
              message.trim()
                ? 'bg-[#25d366] text-white hover:bg-[#1ea756] shadow-sm'
                : 'bg-black/10 text-[#54656f] cursor-not-allowed'
            }`}
            title="Send message"
          >
            <Send size={19} />
          </button>
        </form>
      </div>

      {(callState === 'incoming' || callState === 'outgoing' || callState === 'in-call') && (
        <div className="absolute inset-0 z-40 bg-[#0b141a] text-white">
          {/* Remote video / call background */}
          {callType === 'video' ? (
            <>
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/10 to-black/60" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#1f2c34,#0b141a_60%)]" />
          )}

          {/* Top info */}
          <div className="absolute top-0 inset-x-0 px-5 pt-5 pb-4 bg-gradient-to-b from-black/65 to-transparent">
            <div className="flex items-center gap-3">
              <img
                src={
                  otherUser?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || '?')}&background=25D366&color=fff`
                }
                alt={otherUser?.name}
                className="w-11 h-11 rounded-full object-cover border border-white/25"
              />
              <div>
                <p className="text-base font-semibold leading-tight">{otherUser?.name}</p>
                <p className="text-xs text-white/75">
                  {callState === 'incoming'
                    ? `Incoming ${callType} call`
                    : callState === 'outgoing'
                    ? `Calling...`
                    : `${callType === 'video' ? 'Video' : 'Voice'} call • ${callDuration}`}
                </p>
              </div>
            </div>
          </div>

          {/* Audio mode center avatar */}
          {(callType === 'voice' || (callType === 'video' && !remoteStream)) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-40 h-40 rounded-full bg-white/10 border border-white/25 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-400/35 animate-ping" />
                {otherUser?.avatar ? (
                  <img
                    src={otherUser.avatar}
                    alt={otherUser.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User size={56} className="text-white/70" />
                )}
              </div>
            </div>
          )}

          {/* Local preview (PiP) */}
          {callType === 'video' && (
            <div className="absolute top-22 right-4 w-32 h-44 rounded-2xl overflow-hidden border border-white/30 shadow-xl bg-black/50">
              {!isCameraOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/70">
                  <VideoOff size={22} className="text-white/75" />
                </div>
              )}
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute inset-x-0 bottom-0 px-6 pb-8 pt-12 bg-gradient-to-t from-black/75 to-transparent">
            {callState === 'incoming' ? (
              <div className="flex items-center justify-center gap-10">
                <button
                  onClick={declineIncomingCall}
                  className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center shadow-lg"
                  title="Decline"
                >
                  <PhoneOff size={22} />
                </button>
                <button
                  onClick={acceptIncomingCall}
                  className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center shadow-lg"
                  title="Accept"
                >
                  <Phone size={22} />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-5">
                <button
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-full flex items-center justify-center border border-white/25 ${
                    isMuted ? 'bg-rose-500/90' : 'bg-white/15 hover:bg-white/25'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {callType === 'video' && (
                  <button
                    onClick={toggleCamera}
                    className={`w-12 h-12 rounded-full flex items-center justify-center border border-white/25 ${
                      isCameraOff ? 'bg-rose-500/90' : 'bg-white/15 hover:bg-white/25'
                    }`}
                    title={isCameraOff ? 'Enable camera' : 'Disable camera'}
                  >
                    {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                  </button>
                )}

                <button
                  onClick={endActiveCall}
                  className="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center shadow-lg"
                  title="End call"
                >
                  <PhoneOff size={22} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
