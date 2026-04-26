import { useState, useEffect } from 'react';
import { AuthContext } from './authContextObject.js';
import { initSocket, disconnectSocket } from './socket.js';
import { authAPI } from './api.js';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: validate stored token with the server, get fresh user data
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (!savedToken) {
      setLoading(false);
      return;
    }

    authAPI.me()
      .then((res) => {
        const freshUser = res.data?.user;
        if (freshUser) {
          if (!freshUser._id && freshUser.id) freshUser._id = freshUser.id;
          setToken(savedToken);
          setUser(freshUser);
          localStorage.setItem('user', JSON.stringify(freshUser));
          initSocket(savedToken);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = (userData, authToken) => {
    if (!userData._id && userData.id) userData._id = userData.id;
    setUser(userData);
    setToken(authToken);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    initSocket(authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Clear all E2EE private keys so re-login always fetches a fresh key
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('e2ee_privkey_'))
      .forEach((k) => sessionStorage.removeItem(k));
    disconnectSocket();
  };

  const updateUser = (userData) => {
    if (!userData._id && userData.id) userData._id = userData.id;
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};