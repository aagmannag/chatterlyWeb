import { useState, useEffect } from 'react';
import { Search, X, MessageSquarePlus } from 'lucide-react';
import { formatTime, formatDate, isToday, getReadableMessageText } from '../utils/helpers.jsx';

export default function ChatList({
  contacts,
  searchableUsers,
  selectedId,
  onSelect,
  onlineUsers,
  onNewChat,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const query = searchQuery.toLowerCase().trim();

  const filteredContacts = (contacts || []).filter((entry) => {
    const otherUser = entry.user;
    if (!query) return true;
    return (
      otherUser?.name?.toLowerCase().includes(query) ||
      otherUser?.email?.toLowerCase().includes(query)
    );
  });

  const filteredSearchUsers = query
    ? (searchableUsers || []).filter((u) =>
        u?.name?.toLowerCase().includes(query) ||
        u?.email?.toLowerCase().includes(query)
      )
    : [];

  const isUserOnline = (userId) =>
    (onlineUsers || []).some((id) => String(id) === String(userId));

  const onlineCount = onlineUsers?.length ?? 0;

  return (
    <aside
      className={`flex flex-col w-full lg:w-88 h-full 
        bg-[#0f0f13] border-r border-white/5 overflow-hidden transition-all duration-300
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}
    >
      {/* ── Header ── */}
      <header className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-white/5 bg-gradient-to-b from-indigo-500/5 to-transparent">

        {/* Brand Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_10px_#818cf8] animate-pulse" />
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent">
              Chatterly
            </h1>
          </div>

          <button
            onClick={onNewChat}
            title="New conversation"
            className="flex items-center justify-center w-9 h-9 rounded-xl 
              bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 
              hover:bg-indigo-500/20 hover:scale-105 transition-all duration-150"
          >
            <MessageSquarePlus size={18} />
          </button>
        </div>

        {/* Online count */}
        {onlineCount > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] font-medium text-emerald-400 tracking-wide">
              {onlineCount} online now
            </span>
          </div>
        )}

        {/* Search */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 text-white/30 pointer-events-none" size={15} />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-white/5 border border-white/[0.08] rounded-xl 
              text-[13px] text-white/80 placeholder-white/25 outline-none 
              focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/10 
              focus:bg-white/[0.08] transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      {/* ── Conversations List ── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/[0.08] scrollbar-track-transparent">
        {filteredContacts.length === 0 && filteredSearchUsers.length === 0 ? (

          /* Empty State */
          <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/[0.08] flex items-center justify-center text-white/20 mb-1">
              <Search size={26} />
            </div>
            <p className="text-sm font-semibold text-white/70">
              {contacts?.length === 0 ? 'No chats yet' : 'Nothing found'}
            </p>
            <p className="text-xs text-white/30 leading-relaxed">
              {contacts?.length === 0
                ? 'Search for a user above to start your first chat'
                : `No results for "${searchQuery}"`}
            </p>
            {contacts?.length === 0 && (
              <button
                onClick={onNewChat}
                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                  bg-indigo-500/15 border border-indigo-400/25 text-indigo-400
                  hover:bg-indigo-500/25 hover:scale-105 transition-all duration-150"
              >
                <MessageSquarePlus size={14} />
                Start a chat
              </button>
            )}
          </div>

        ) : (
          <>
            {filteredContacts.map((entry, i) => {
              const otherUser = entry.user;
              const conv = entry.conversation;
              const isOnline = isUserOnline(otherUser?._id || otherUser?.id);
              const isSelected = selectedId === conv?._id;
              const lastText = getReadableMessageText(conv?.lastMessage);
              const hasAttachment =
                Boolean(conv?.lastMessage?.attachmentUrl) ||
                Boolean(conv?.lastMessage?.attachments?.[0]);
              const lastTime = conv?.lastMessage?.createdAt;

              return (
                <button
                  key={otherUser._id}
                  onClick={() => onSelect(conv)}
                  style={{ animationDelay: `${i * 40}ms`, animation: 'fadeSlideIn 0.3s ease both' }}
                  className={`relative flex items-center gap-3 w-full px-4 py-3 text-left 
                    border-b border-white/[0.04] border-l-2 transition-all duration-150 group
                    ${isSelected
                      ? 'bg-indigo-500/10 border-l-indigo-400'
                      : 'border-l-transparent hover:bg-white/[0.035]'
                    }`}
                >
                  {isSelected && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 
                      rounded-r-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                  )}

                  <div className="relative flex-shrink-0">
                    <img
                      src={
                        otherUser?.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name ?? '?')}&background=6366f1&color=fff&bold=true`
                      }
                      alt={otherUser?.name}
                      className={`w-12 h-12 rounded-full object-cover border-2 transition-colors
                        ${isSelected
                          ? 'border-indigo-400/50'
                          : 'border-white/10 group-hover:border-white/20'
                        }`}
                    />
                    {isOnline && (
                      <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full 
                        bg-emerald-400 border-2 border-[#0f0f13] shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-[13.5px] font-semibold text-white/85 truncate">
                        {otherUser?.name}
                      </span>
                      <span className={`text-[11px] flex-shrink-0 ${isOnline ? 'text-emerald-400' : 'text-white/30'}`}>
                        {lastTime
                          ? isToday(lastTime)
                            ? formatTime(lastTime)
                            : formatDate(lastTime)
                          : 'New'}
                      </span>
                    </div>
                    <p className="text-[12px] text-white/35 truncate leading-snug flex items-center gap-1.5">
                      {lastText
                        ? lastText.length > 45
                          ? `${lastText.slice(0, 45)}…`
                          : lastText
                        : hasAttachment
                        ? '📎 Media/File'
                        : 'Start chatting'}
                    </p>
                  </div>
                </button>
              );
            })}

            {query && filteredSearchUsers.length > 0 && (
              <div className="px-4 pt-3 pb-2">
                <p className="text-[11px] uppercase tracking-wider text-white/35">People</p>
              </div>
            )}

            {query && filteredSearchUsers.map((u) => (
              <button
                key={`search-${u._id}`}
                onClick={() => onSelect(u)}
                className="relative flex items-center gap-3 w-full px-4 py-3 text-left border-b border-white/[0.04] border-l-2 border-l-transparent hover:bg-white/[0.035] transition-all duration-150"
              >
                <div className="relative flex-shrink-0">
                  <img
                    src={
                      u?.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(u?.name ?? '?')}&background=6366f1&color=fff&bold=true`
                    }
                    alt={u?.name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/10"
                  />
                  {isUserOnline(u?._id || u?.id) && (
                    <span className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0f0f13]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-white/85 truncate">{u?.name}</p>
                  <p className="text-[12px] text-white/35 truncate">Tap to start chat</p>
                </div>
              </button>
            ))}
          </>
        )}
      </div>

      {/* One tiny keyframe not available in base Tailwind */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </aside>
  );
}