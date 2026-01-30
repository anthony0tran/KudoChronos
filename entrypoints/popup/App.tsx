import { browser } from 'wxt/browser';
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [feedCount, setFeedCount] = useState<number | null>(null);

  // Load feed count from storage on mount
  useEffect(() => {
    browser.storage.local.get('feedCount').then((result) => {
      console.log('Loaded from storage:', result);
      if (result.feedCount !== undefined && typeof result.feedCount === 'number') {
        setFeedCount(result.feedCount);
      }
    });
  }, []);

  const handleClick = async () => {
    // Check if current active tab is already on Strava
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    
    let targetTab;
    if (activeTab?.url?.includes('strava.com')) {
      debugger;
      // Already on Strava, use current tab
      targetTab = activeTab;
      // Navigate to dashboard if not already there
      if (!activeTab.url.includes('strava.com/dashboard')) {
        await browser.tabs.update(activeTab.id!, { url: 'https://www.strava.com/dashboard' });
      }
    } else {
      // Not on Strava, open new tab
      targetTab = await browser.tabs.create({ url: 'https://www.strava.com/dashboard' });
    }
    
    // Wait for dashboard to load
    const listener = (tabId: number, changeInfo: any) => {
      if (tabId === targetTab.id && changeInfo.status === 'complete') {
        browser.tabs.get(tabId).then((updatedTab) => {
          if (updatedTab.url?.includes('strava.com/dashboard')) {
            browser.tabs.onUpdated.removeListener(listener);
            
            // Request feed entries from content script
            console.log('Sending message to tab:', tabId);
            browser.tabs.sendMessage(tabId, { action: 'getFeedEntries' })
              .then((response) => {
                console.log('Feed entries retrieved:', response);
                console.log('Setting feedCount to:', response.count);
                setFeedCount(response.count);
                // Save to storage so it persists when popup reopens
                browser.storage.local.set({ feedCount: response.count });
                // TODO: Process feed entries and give kudos
              })
              .catch((error) => console.error('Error getting feed entries:', error));
          }
        });
      }
    };
    
    browser.tabs.onUpdated.addListener(listener);
  };

  return (
    <div className="popup-container">
      <h1>KudoChronos</h1>
      {feedCount !== null && <h2>Feed entries: {feedCount}</h2>}
      <button onClick={handleClick}>
        Give kudos!
      </button>
    </div>
  );
}

export default App;
