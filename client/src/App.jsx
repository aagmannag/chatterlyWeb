import { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './services/authContextObject.js';
import NavBar from './components/NavBar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Chat from './pages/Chat';
import Status from './pages/Status';

function ProtectedRoute({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
          <p className="text-sm text-white/30">Loading…</p>
        </div>
      </div>
    );
  }

  return user ? (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      <NavBar />
      {children}
    </div>
  ) : (
    <Navigate to="/login" />
  );
}

export default function App() {
  const { user } = useContext(AuthContext);

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/chat" /> : <Login />}
      />
      <Route
        path="/signup"
        element={user ? <Navigate to="/chat" /> : <Signup />}
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/status"
        element={
          <ProtectedRoute>
            <Status />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/chat" />} />
    </Routes>
  );
}