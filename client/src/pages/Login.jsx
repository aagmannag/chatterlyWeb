import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Loader, Zap, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../services/api.js';
import { useContext } from 'react';
import { AuthContext } from '../services/authContextObject.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authAPI.login({ email, password });
      const { token, user } = response.data;
      login(user, token);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('demo@example.com');
    setPassword('demo123');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />

      <div
        className="w-full max-w-md relative z-10"
        style={{ animation: 'fadeUp 0.4s ease both' }}
      >
        {/* Card */}
        <div className="bg-[#13131a] border border-white/[0.07] rounded-2xl shadow-2xl overflow-hidden">

          {/* Top accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-indigo-400/60 to-transparent" />

          <div className="px-8 py-10">
            {/* Brand */}
            <div className="flex flex-col items-center mb-10">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl
                bg-indigo-500/15 border border-indigo-400/25 mb-4">
                <Zap size={22} className="text-indigo-400" fill="currentColor" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-indigo-400 bg-clip-text text-transparent">
                Welcome back
              </h1>
              <p className="text-sm text-white/30 mt-1.5">Sign in to your Chatterly account</p>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 mb-6 rounded-xl
                bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0 text-xs font-bold">!</span>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" size={16} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl
                      text-sm text-white/80 placeholder-white/20 outline-none
                      focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/10
                      focus:bg-white/[0.08] transition-all duration-200"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" size={16} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl
                      text-sm text-white/80 placeholder-white/20 outline-none
                      focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/10
                      focus:bg-white/[0.08] transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl font-semibold text-sm
                  bg-indigo-500 text-white hover:bg-indigo-400
                  shadow-[0_4px_20px_rgba(99,102,241,0.35)]
                  hover:shadow-[0_4px_24px_rgba(99,102,241,0.5)]
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader size={16} className="animate-spin" />
                    Signing in…
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-white/20">or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Sign up link */}
            <Link
              to="/signup"
              className="flex items-center justify-center w-full py-3 rounded-xl
                border border-white/[0.08] text-sm font-semibold text-white/50
                hover:text-white/80 hover:border-white/15 hover:bg-white/[0.03]
                transition-all duration-200"
            >
              Create a new account
            </Link>

            {/* Demo credentials */}
            <button
              type="button"
              onClick={fillDemo}
              className="w-full mt-4 py-2.5 px-4 rounded-xl bg-indigo-500/8 border border-indigo-400/15
                text-xs text-indigo-300/60 hover:text-indigo-300/90 hover:bg-indigo-500/12
                transition-all duration-200 text-center"
            >
              Use demo account · <span className="font-mono">demo@example.com</span>
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-white/15 mt-6">
          Chatterly · Connect Instantly
        </p>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}