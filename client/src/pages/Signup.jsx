import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Loader, Zap, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../services/api.js';
import { AuthContext } from '../services/authContextObject.js';

export default function Signup() {
  const [name, setName] = useState('');
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
      await authAPI.signup({ name, email, password });
      const loginResponse = await authAPI.login({ email, password });
      const { token, user } = loginResponse.data;
      login(user, token);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    {
      label: 'Full Name',
      icon: <User size={16} />,
      type: 'text',
      value: name,
      onChange: setName,
      placeholder: 'John Doe',
    },
    {
      label: 'Email Address',
      icon: <Mail size={16} />,
      type: 'email',
      value: email,
      onChange: setEmail,
      placeholder: 'you@example.com',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 relative overflow-hidden">

      {/* Background glow orbs */}
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />

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
                Join Chatterly
              </h1>
              <p className="text-sm text-white/30 mt-1.5">Create your account and start connecting</p>
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
              {/* Name & Email fields */}
              {fields.map(({ label, icon, type, value, onChange, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
                      {icon}
                    </span>
                    <input
                      type={type}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      placeholder={placeholder}
                      required
                      className="w-full pl-10 pr-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-xl
                        text-sm text-white/80 placeholder-white/20 outline-none
                        focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/10
                        focus:bg-white/[0.08] transition-all duration-200"
                    />
                  </div>
                </div>
              ))}

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
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
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

                {/* Password strength indicator */}
                {password.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${
                          password.length >= level * 3
                            ? password.length >= 10
                              ? 'bg-emerald-400'
                              : password.length >= 6
                              ? 'bg-indigo-400'
                              : 'bg-rose-400'
                            : 'bg-white/[0.08]'
                        }`}
                      />
                    ))}
                  </div>
                )}
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
                    Creating account…
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-white/20">or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Login link */}
            <Link
              to="/login"
              className="flex items-center justify-center w-full py-3 rounded-xl
                border border-white/[0.08] text-sm font-semibold text-white/50
                hover:text-white/80 hover:border-white/15 hover:bg-white/[0.03]
                transition-all duration-200"
            >
              Already have an account? Sign in
            </Link>

            {/* Terms */}
            <p className="text-center text-[11px] text-white/15 mt-5 leading-relaxed">
              By creating an account you agree to our{' '}
              <span className="text-white/25 hover:text-white/40 cursor-pointer transition-colors">Terms of Service</span>
              {' '}and{' '}
              <span className="text-white/25 hover:text-white/40 cursor-pointer transition-colors">Privacy Policy</span>
            </p>
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