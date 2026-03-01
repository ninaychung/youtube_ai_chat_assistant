import { useState, useEffect } from 'react';
import Auth from './components/Auth';
import AppTabs from './components/AppTabs';
import { getUserProfile } from './services/mongoApi';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('chatapp_user');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed.username === 'string'
        ? parsed
        : { username: raw, firstName: null, lastName: null };
    } catch {
      return { username: raw, firstName: null, lastName: null };
    }
  });

  // When we have a user but missing names, load from server (e.g. account created with names, or old localStorage)
  useEffect(() => {
    if (!user?.username) return;
    if (user.firstName || user.lastName) return; // already have at least one name
    getUserProfile(user.username)
      .then((profile) => {
        if (profile.firstName || profile.lastName) {
          const next = {
            ...user,
            firstName: profile.firstName ?? user.firstName,
            lastName: profile.lastName ?? user.lastName,
          };
          setUser(next);
          localStorage.setItem('chatapp_user', JSON.stringify(next));
        }
      })
      .catch(() => {});
  }, [user?.username]);

  const handleLogin = (userData) => {
    const payload =
      typeof userData === 'string'
        ? { username: userData, firstName: null, lastName: null }
        : userData;
    localStorage.setItem('chatapp_user', JSON.stringify(payload));
    setUser(payload);
  };

  const handleLogout = () => {
    localStorage.removeItem('chatapp_user');
    setUser(null);
  };

  if (user) {
    return <AppTabs user={user} onLogout={handleLogout} />;
  }
  return <Auth onLogin={handleLogin} />;
}

export default App;
