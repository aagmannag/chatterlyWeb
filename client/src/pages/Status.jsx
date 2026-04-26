import { useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import {
  Plus,
  Upload,
  X,
  Eye,
  Trash2,
  Image as ImageIcon,
  Video,
  Music,
  ChevronLeft,
  ChevronRight,
  Camera,
} from 'lucide-react';
import { statusAPI } from '../services/api.js';
import { socketHandlers, getSocket } from '../services/socket.js';
import { AuthContext } from '../services/authContextObject.js';

const getUserId = (u) => u?._id || u?.id || null;

const formatStatusTime = (dateString) => {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Status() {
  const { user } = useContext(AuthContext);
  const currentUserId = getUserId(user);
  const socket = getSocket();

  const [statuses, setStatuses] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaType, setMediaType] = useState('image');
  const [caption, setCaption] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');

  const [viewNotification, setViewNotification] = useState('');
  const [storyViewers, setStoryViewers] = useState([]);
  const [storyViewersLoading, setStoryViewersLoading] = useState(false);

  const [storyViewer, setStoryViewer] = useState({
    open: false,
    owner: null,
    items: [],
    index: 0,
    isMine: false,
  });

  const notificationTimer = useRef(null);
  const storyAutoAdvanceTimer = useRef(null);

  const STORY_DURATION_MS = 10000;

  const loadStatuses = async () => {
    try {
      const [statusRes, myRes] = await Promise.all([
        statusAPI.getStatuses(),
        statusAPI.getMyStatuses(),
      ]);
      setStatuses(statusRes?.data || []);
      setMyStatuses(myRes?.data || []);
    } catch (err) {
      console.error('Failed to load statuses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onStatusNew = () => {
      loadStatuses();
    };

    const onStatusDeleted = (data) => {
      setStatuses((prev) =>
        prev
          .map((group) => ({
            ...group,
            statuses: group.statuses.filter((st) => st._id !== data.statusId),
          }))
          .filter((group) => group.statuses.length > 0)
      );
      setMyStatuses((prev) => prev.filter((st) => st._id !== data.statusId));

      setStoryViewer((prev) => {
        if (!prev.open) return prev;
        const filtered = prev.items.filter((st) => st._id !== data.statusId);
        if (filtered.length === 0) {
          return { open: false, owner: null, items: [], index: 0, isMine: false };
        }
        const safeIndex = Math.min(prev.index, filtered.length - 1);
        return { ...prev, items: filtered, index: safeIndex };
      });
    };

    const onStatusViewNotification = (data) => {
      setViewNotification(`${data.viewerName || 'Someone'} viewed your status`);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
      notificationTimer.current = setTimeout(() => setViewNotification(''), 3000);
    };

    socket.on('status:new', onStatusNew);
    socket.on('status:deleted', onStatusDeleted);
    socket.on('status:view-notification', onStatusViewNotification);

    return () => {
      socket.off('status:new', onStatusNew);
      socket.off('status:deleted', onStatusDeleted);
      socket.off('status:view-notification', onStatusViewNotification);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, [socket]);

  const recentUpdates = useMemo(() => {
    const groups = statuses || [];
    return groups
      .map((group) => {
        const sortedStatuses = [...(group.statuses || [])].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        return { ...group, statuses: sortedStatuses };
      })
      .sort((a, b) => {
        const aTime = a.statuses?.[0]?.createdAt || 0;
        const bTime = b.statuses?.[0]?.createdAt || 0;
        return new Date(bTime) - new Date(aTime);
      });
  }, [statuses]);

  const latestMyStatus = myStatuses?.[0] || null;

  const openUploadModal = () => {
    setShowUpload(true);
  };

  const closeUploadModal = () => {
    setShowUpload(false);
    setSelectedFile(null);
    setCaption('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) setMediaType('image');
    else if (file.type.startsWith('video/')) setMediaType('video');
    else if (file.type.startsWith('audio/')) setMediaType('audio');

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setSelectedFile(file);
  };

  const handleUploadStatus = async () => {
    if (!selectedFile || !currentUserId) return;

    setUploading(true);
    try {
      const response = await statusAPI.uploadStatus(selectedFile, mediaType, caption);
      const created = response?.data?.status;
      if (created) {
        socketHandlers.broadcastStatus({
          statusId: created._id,
          userId: currentUserId,
          mediaUrl: created.mediaUrl,
          mediaType: created.mediaType,
          caption: created.caption,
          user: {
            _id: currentUserId,
            name: user?.name,
            avatar: user?.avatar,
          },
        });
        setMyStatuses((prev) => [created, ...prev]);
      }
      closeUploadModal();
    } catch (err) {
      console.error('Failed to upload status:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteStatus = async (statusId) => {
    if (!window.confirm('Delete this status?')) return;

    try {
      await statusAPI.deleteStatus(statusId);
      socketHandlers.deleteStatus(statusId, currentUserId);
      setMyStatuses((prev) => prev.filter((s) => s._id !== statusId));
      setStoryViewer((prev) => {
        if (!prev.open) return prev;
        const filtered = prev.items.filter((st) => st._id !== statusId);
        if (filtered.length === 0) {
          return { open: false, owner: null, items: [], index: 0, isMine: false };
        }
        const safeIndex = Math.min(prev.index, filtered.length - 1);
        return { ...prev, items: filtered, index: safeIndex };
      });
    } catch (err) {
      console.error('Failed to delete status:', err);
    }
  };

  const openStoryViewer = async ({ owner, items, index = 0, isMine = false }) => {
    const safeItems = items || [];
    if (!safeItems.length) return;

    const safeIndex = Math.min(Math.max(index, 0), safeItems.length - 1);
    const firstItem = safeItems[safeIndex];

    setStoryViewer({
      open: true,
      owner,
      items: safeItems,
      index: safeIndex,
      isMine,
    });

    if (isMine && firstItem?._id) {
      setStoryViewersLoading(true);
      try {
        const viewersRes = await statusAPI.getViewers(firstItem._id);
        setStoryViewers(viewersRes?.data?.viewers || []);
      } catch {
        setStoryViewers([]);
      } finally {
        setStoryViewersLoading(false);
      }
    }

    if (!isMine && firstItem?._id && owner?._id) {
      try {
        await statusAPI.markAsViewed(firstItem._id);
        socketHandlers.markStatusViewed(firstItem._id, owner._id, user?.name);
      } catch (err) {
        console.error('Failed to mark status viewed:', err);
      }
    }
  };

  const closeStoryViewer = () => {
    setStoryViewer({ open: false, owner: null, items: [], index: 0, isMine: false });
    setStoryViewers([]);
    setStoryViewersLoading(false);
  };

  const goStory = useCallback(async (direction) => {
    const { items, index, isMine, owner } = storyViewer;
    if (!items.length) return;

    const nextIndex = direction === 'next' ? index + 1 : index - 1;
    if (nextIndex < 0 || nextIndex >= items.length) return;

    const nextItem = items[nextIndex];
    setStoryViewer((prev) => ({ ...prev, index: nextIndex }));

    if (isMine && nextItem?._id) {
      setStoryViewersLoading(true);
      try {
        const viewersRes = await statusAPI.getViewers(nextItem._id);
        setStoryViewers(viewersRes?.data?.viewers || []);
      } catch {
        setStoryViewers([]);
      } finally {
        setStoryViewersLoading(false);
      }
    }

    if (!isMine && nextItem?._id && owner?._id) {
      try {
        await statusAPI.markAsViewed(nextItem._id);
        socketHandlers.markStatusViewed(nextItem._id, owner._id, user?.name);
      } catch (err) {
        console.error('Failed to mark status viewed:', err);
      }
    }
  }, [storyViewer, user?.name]);

  useEffect(() => {
    if (!storyViewer.open || storyViewer.items.length === 0) return;

    if (storyAutoAdvanceTimer.current) {
      clearTimeout(storyAutoAdvanceTimer.current);
    }

    storyAutoAdvanceTimer.current = setTimeout(() => {
      const isLast = storyViewer.index >= storyViewer.items.length - 1;
      if (isLast) {
        closeStoryViewer();
      } else {
        goStory('next');
      }
    }, STORY_DURATION_MS);

    return () => {
      if (storyAutoAdvanceTimer.current) {
        clearTimeout(storyAutoAdvanceTimer.current);
      }
    };
  }, [storyViewer.open, storyViewer.index, storyViewer.items.length, goStory]);

  const currentStory = storyViewer.items[storyViewer.index];

  if (loading) {
    return (
      <div className="h-screen lg:h-[calc(100vh-80px)] lg:mt-20 pb-16 lg:pb-0 bg-[#0b141a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          <p className="text-sm text-white/40">Loading status updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen lg:h-[calc(100vh-80px)] lg:mt-20 pb-20 lg:pb-0 bg-[#0b141a] text-white relative overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8 space-y-5">
        <h1 className="text-xl font-bold text-white/90">Status</h1>

        {viewNotification && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
            {viewNotification}
          </div>
        )}

        <section className="rounded-2xl border border-white/10 bg-[#111b21] overflow-hidden">
          <button
            onClick={() => {
              if (myStatuses.length) {
                openStoryViewer({
                  owner: { _id: currentUserId, name: 'My Status', avatar: user?.avatar },
                  items: myStatuses,
                  index: 0,
                  isMine: true,
                });
              } else {
                openUploadModal();
              }
            }}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors"
          >
            <div className="relative">
              <img
                src={
                  user?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'Me')}&background=25D366&color=fff`
                }
                alt="me"
                className="w-14 h-14 rounded-full object-cover"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openUploadModal();
                }}
                className="absolute -right-0.5 -bottom-0.5 w-6 h-6 rounded-full bg-[#25d366] text-[#0b141a] border-2 border-[#111b21] flex items-center justify-center hover:scale-105 transition-transform"
                title="Add new status"
              >
                <Plus size={15} />
              </button>
            </div>

            <div className="text-left min-w-0">
              <p className="font-semibold text-white/90">My Status</p>
              <p className="text-sm text-white/45 truncate">
                {latestMyStatus
                  ? `Last update ${formatStatusTime(latestMyStatus.createdAt)}`
                  : 'Tap to add status update'}
              </p>
            </div>

            {myStatuses.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openUploadModal();
                }}
                className="ml-auto px-3 py-1.5 rounded-full bg-emerald-400/15 text-emerald-300 text-xs font-semibold hover:bg-emerald-400/25 transition-colors"
                title="Add another status"
              >
                Add
              </button>
            )}
          </button>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold text-white/45 tracking-widest uppercase px-1">
            Recent updates
          </h2>

          {recentUpdates.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#111b21] py-14 px-6 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/25">
                <ImageIcon size={28} />
              </div>
              <p className="mt-4 font-semibold text-white/65">No statuses yet</p>
              <p className="text-sm text-white/35 mt-1">You and your contacts can share photos, videos, and audio updates here.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#111b21] divide-y divide-white/5">
              {recentUpdates.map((group) => {
                const latest = group.statuses?.[0];
                const owner = group.user;
                return (
                  <button
                    key={owner._id}
                    onClick={() =>
                      openStoryViewer({ owner, items: group.statuses, index: 0, isMine: false })
                    }
                    className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 text-left">
                      <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-b from-[#25d366] to-[#0aa45f]">
                        <img
                          src={
                            owner.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.name || '?')}&background=25D366&color=fff`
                          }
                          alt={owner.name}
                          className="w-full h-full rounded-full object-cover border-2 border-[#111b21]"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white/90 truncate">{owner.name}</p>
                        <p className="text-sm text-white/45 truncate">
                          {latest?.caption || `${latest?.mediaType || 'status'} update`} • {formatStatusTime(latest?.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-white/35">{group.statuses.length}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <button
        onClick={openUploadModal}
        className="fixed bottom-6 right-6 z-20 w-14 h-14 rounded-full bg-[#25d366] text-[#0b141a] shadow-[0_8px_30px_rgba(37,211,102,0.35)] hover:scale-105 transition-transform flex items-center justify-center"
        title="Add status"
      >
        <Plus size={24} />
      </button>

      {showUpload && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeUploadModal()}
        >
          <div className="w-full max-w-md rounded-2xl bg-[#111b21] border border-white/10 overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold text-white/90">Add status</h3>
              <button
                onClick={closeUploadModal}
                className="w-8 h-8 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <label className="block border-2 border-dashed border-white/15 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400/40 hover:bg-emerald-400/5 transition-all">
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload size={20} className="mx-auto mb-2 text-white/45" />
                {selectedFile ? (
                  <p className="text-sm text-white/80 truncate">{selectedFile.name}</p>
                ) : (
                  <p className="text-sm text-white/55">Tap to select image, video, or audio</p>
                )}
              </label>

              {previewUrl && mediaType === 'image' && (
                <img
                  src={previewUrl}
                  alt="preview"
                  className="w-full h-44 object-cover rounded-xl border border-white/10"
                />
              )}

              {previewUrl && mediaType === 'video' && (
                <video
                  src={previewUrl}
                  controls
                  className="w-full h-44 object-cover rounded-xl border border-white/10"
                />
              )}

              <textarea
                rows={3}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 placeholder-white/30 outline-none focus:border-emerald-400/40"
              />

              <button
                onClick={handleUploadStatus}
                disabled={!selectedFile || uploading}
                className="w-full py-3 rounded-xl font-semibold bg-[#25d366] text-[#0b141a] hover:bg-[#20bf5b] disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Share status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {storyViewer.open && currentStory && (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm">
          <div className="absolute top-0 inset-x-0 p-4 z-10 bg-gradient-to-b from-black/70 to-transparent">
            <div className="flex items-center gap-2 mb-3">
              {storyViewer.items.map((item, i) => (
                <div key={item._id || i} className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden">
                  {i < storyViewer.index && <div className="h-full w-full bg-white" />}
                  {i > storyViewer.index && <div className="h-full w-0 bg-white" />}
                  {i === storyViewer.index && (
                    <div
                      key={`${item._id || i}-${storyViewer.index}`}
                      className="h-full bg-white animate-storyProgress"
                      style={{ animationDuration: `${STORY_DURATION_MS}ms` }}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={
                    storyViewer.owner?.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(storyViewer.owner?.name || '?')}&background=25D366&color=fff`
                  }
                  alt={storyViewer.owner?.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold">{storyViewer.owner?.name || 'Status'}</p>
                  <p className="text-xs text-white/70">{formatStatusTime(currentStory.createdAt)}</p>
                </div>
              </div>
              <button
                onClick={closeStoryViewer}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="h-full w-full flex items-center justify-center px-4 py-20">
            {currentStory.mediaType === 'image' && (
              <img
                src={currentStory.mediaUrl}
                alt="status"
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            )}

            {currentStory.mediaType === 'video' && (
              <video
                src={currentStory.mediaUrl}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-xl object-contain"
              />
            )}

            {currentStory.mediaType === 'audio' && (
              <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-white/5 p-8 text-center">
                <Music size={34} className="mx-auto mb-3 text-emerald-300" />
                <p className="text-white/80 mb-4">Audio status</p>
                <audio src={currentStory.mediaUrl} controls className="w-full" />
              </div>
            )}
          </div>

          {currentStory.caption && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-[92%] rounded-xl bg-black/50 border border-white/20 px-4 py-3 text-sm text-white/85 text-center">
              {currentStory.caption}
            </div>
          )}

          <button
            onClick={() => goStory('prev')}
            disabled={storyViewer.index === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            onClick={() => goStory('next')}
            disabled={storyViewer.index >= storyViewer.items.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
          >
            <ChevronRight size={20} />
          </button>

          {storyViewer.isMine && (
            <div className="absolute bottom-6 right-6 flex items-center gap-2">
              <button
                onClick={openUploadModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-500/90 hover:bg-emerald-500 text-white text-sm"
              >
                <Camera size={15} />
                Add
              </button>
              <button
                onClick={() => handleDeleteStatus(currentStory._id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-rose-500/90 hover:bg-rose-500 text-white text-sm"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          )}

          {storyViewer.isMine && (
            <div className="absolute bottom-6 left-6 max-w-xs rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-xs text-white/85">
              <p className="font-semibold mb-1">Views</p>
              {storyViewersLoading ? (
                <p className="text-white/70">Loading viewers...</p>
              ) : storyViewers.length ? (
                <p className="text-white/75">
                  {storyViewers.map((v) => v?.userId?.name).filter(Boolean).join(', ')}
                </p>
              ) : (
                <p className="text-white/60">No views yet</p>
              )}
            </div>
          )}

          {!storyViewer.isMine && (
            <div className="absolute bottom-6 left-6 flex items-center gap-1.5 text-xs text-white/70">
              <Eye size={14} />
              Viewed privately
            </div>
          )}
        </div>
      )}

      <style>{`
        audio::-webkit-media-controls-panel {
          background-color: rgba(255, 255, 255, 0.85);
        }
        @keyframes storyProgress {
          from { width: 0%; }
          to { width: 100%; }
        }
        .animate-storyProgress {
          animation-name: storyProgress;
          animation-timing-function: linear;
          animation-fill-mode: forwards;
        }
      `}</style>
    </div>
  );
}
