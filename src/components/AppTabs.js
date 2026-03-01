import { useState } from 'react';
import Chat from './Chat';
import YouTubeDownload from './YouTubeDownload';
import './AppTabs.css';

export default function AppTabs({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('chat');

  return (
    <div className="app-tabs">
      <header className="app-tabs-header">
        <nav className="app-tabs-nav">
          <button
            type="button"
            className={`app-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            type="button"
            className={`app-tab ${activeTab === 'youtube' ? 'active' : ''}`}
            onClick={() => setActiveTab('youtube')}
          >
            YouTube Channel Download
          </button>
        </nav>
        <button type="button" className="app-tabs-logout" onClick={onLogout}>
          Log out
        </button>
      </header>
      <main className="app-tabs-main">
        {activeTab === 'chat' && (
          <Chat
            username={user.username}
            firstName={user.firstName}
            lastName={user.lastName}
            onLogout={onLogout}
          />
        )}
        {activeTab === 'youtube' && <YouTubeDownload onLogout={onLogout} />}
      </main>
    </div>
  );
}
