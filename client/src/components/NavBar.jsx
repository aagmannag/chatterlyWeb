import { useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Image, LogOut, Settings, Info, Zap, X } from 'lucide-react';
import { AuthContext } from '../services/authContextObject.js';
import { userAPI } from '../services/api.js';

export default function NavBar() {
  const { user, logout, updateUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const avatarInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  if (!user) return null;

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileBio(user?.bio || '');
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAvatarClick = () => {
    if (avatarUploading) return;
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Please choose an image file.');
      return;
    }

    setAvatarUploading(true);
    try {
      const response = await userAPI.uploadAvatar(file);
      const updatedUser = response?.data?.user;
      if (updatedUser) {
        updateUser(updatedUser);
      }
    } catch (error) {
      console.error('Failed to upload avatar:', error);
      window.alert('Avatar upload failed. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileError('');
    setSavingProfile(true);
    try {
      const res = await userAPI.updateMyProfile({
        name: profileName,
        bio: profileBio,
      });
      const updatedUser = res?.data?.user;
      if (updatedUser) {
        updateUser(updatedUser);
      }
      setShowProfileModal(false);
    } catch (error) {
      setProfileError(error?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const navLinks = [
    { label: 'Messages', icon: <MessageCircle size={18} />, path: '/chat' },
    { label: 'Status', icon: <Image size={18} />, path: '/status' },
  ];

  return (
    <>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      <nav className="hidden lg:flex items-center justify-between fixed top-0 left-0 right-0 z-50 h-20
        bg-[#0a0a0f] border-b border-white/[0.06] px-0"
        style={{ backdropFilter: 'blur(12px)' }}
      >
        {/* ── Brand ── */}
        <div className="flex items-center gap-3 px-7 h-full border-r border-white/[0.06] flex-shrink-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl 
            bg-indigo-500/15 border border-indigo-400/25">
            <Zap size={18} className="text-indigo-400" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent leading-none">
              Chatterly
            </h1>
            <p className="text-[10px] text-white/25 font-medium tracking-widest uppercase mt-0.5">
              Connect Instantly
            </p>
          </div>
        </div>

        {/* ── Nav Links ── */}
        <div className="flex items-stretch h-full flex-1 px-4">
          {navLinks.map(({ label, icon, path }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`relative flex items-center gap-2 px-6 text-sm font-semibold
                  transition-all duration-200 group
                  ${isActive ? 'text-white' : 'text-white/35 hover:text-white/70'}`}
              >
                <span className={`transition-colors duration-200 ${isActive ? 'text-indigo-400' : 'group-hover:text-white/50'}`}>
                  {icon}
                </span>
                {label}

                {/* Active underline */}
                {isActive && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2px] rounded-t-full 
                    bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Right Section ── */}
        <div className="flex items-center gap-3 px-7 h-full border-l border-white/[0.06]">
          {/* User info */}
          <div className="flex items-center gap-3 mr-1">
            <div className="relative">
              <img
                onClick={handleAvatarClick}
                src={
                  user?.avatar ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? '?')}&background=6366f1&color=fff&bold=true`
                }
                alt="avatar"
                title={avatarUploading ? 'Uploading avatar...' : 'Change profile photo'}
                className={`w-9 h-9 rounded-full object-cover border-2 transition-colors ${
                  avatarUploading
                    ? 'border-emerald-400/70 animate-pulse cursor-wait'
                    : 'border-white/10 hover:border-indigo-400/50 cursor-pointer'
                }`}
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full 
                bg-emerald-400 border-2 border-[#0a0a0f] shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-white/85">{user?.name}</span>
              <span className="text-[11px] text-white/30 truncate max-w-[130px]">{user?.email}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              title="Settings"
              onClick={() => {
                setProfileName(user?.name || '');
                setProfileBio(user?.bio || '');
                setProfileError('');
                setShowProfileModal(true);
              }}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white/30 
                hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-150"
            >
              <Settings size={17} />
            </button>

            <button
              title="Info"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-white/30 
                hover:text-indigo-400 hover:bg-indigo-500/10 transition-all duration-150"
            >
              <Info size={17} />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 ml-1 px-3.5 py-2 rounded-lg text-sm font-semibold
                text-rose-400 border border-rose-500/20 bg-rose-500/8
                hover:bg-rose-500/15 hover:border-rose-400/30 hover:text-rose-300
                transition-all duration-150"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-white/[0.08] bg-[#0a0a0f]/95"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <div className="grid grid-cols-4 h-full px-1">
          {navLinks.map(({ label, icon, path }) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`relative flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors ${
                  isActive ? 'text-indigo-300' : 'text-white/45 hover:text-white/70'
                }`}
              >
                <span className={isActive ? 'text-indigo-400' : ''}>{icon}</span>
                {label}
                {isActive && (
                  <span className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full bg-indigo-400" />
                )}
              </button>
            );
          })}

          <button
            onClick={handleAvatarClick}
            className="flex flex-col items-center justify-center gap-1 text-[10px] text-white/55"
            title={avatarUploading ? 'Uploading avatar...' : 'Profile'}
          >
            <img
              src={
                user?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name ?? '?')}&background=6366f1&color=fff&bold=true`
              }
              alt="avatar"
              className={`w-7 h-7 rounded-full object-cover border ${
                avatarUploading ? 'border-emerald-400/80 animate-pulse' : 'border-white/25'
              }`}
            />
            Profile
          </button>

          <button
            onClick={handleLogout}
            className="flex flex-col items-center justify-center gap-1 text-[10px] text-rose-300/85 hover:text-rose-200"
            title="Logout"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </nav>

      {showProfileModal && (
        <div
          className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setShowProfileModal(false)}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#11131a] overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-white/90 font-semibold">Edit Profile</h3>
              <button
                onClick={() => setShowProfileModal(false)}
                className="w-8 h-8 rounded-lg text-white/40 hover:text-white/70 hover:bg-white/5 flex items-center justify-center"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div>
                <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">Name</label>
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/85 outline-none focus:border-indigo-400/40"
                />
              </div>

              <div>
                <label className="block text-xs text-white/50 uppercase tracking-wider mb-2">About</label>
                <textarea
                  rows={3}
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/85 outline-none focus:border-indigo-400/40"
                  placeholder="Hey there! I am using Chatterly."
                />
              </div>

              {profileError && (
                <p className="text-sm text-rose-400">{profileError}</p>
              )}

              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold disabled:opacity-50"
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}