import { browser } from 'wxt/browser';
import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [feedCount, setFeedCount] = useState<number | null>(null);
  const [kudoCount, setKudoCount] = useState<number | null>(null);
  const [kudosClicked, setKudosClicked] = useState<number>(0);
  const [isGivingKudos, setIsGivingKudos] = useState<boolean>(false);

  // Load feed count from storage on mount
  useEffect(() => {
    browser.storage.local.get('feedCount').then((result) => {
      console.log('Loaded from storage:', result);
      if (result.feedCount !== undefined && typeof result.feedCount === 'number') {
        setFeedCount(result.feedCount);
      }
    });
  }, []);

  const waitForTabComplete = async (tabId: number) => {
    const currentTab = await browser.tabs.get(tabId);
    if (currentTab.status === 'complete') {
      return;
    }

    await new Promise<void>((resolve) => {
      const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          browser.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      browser.tabs.onUpdated.addListener(listener);
    });
  };

  const runKudosOnTab = async (tabId: number) => {
    const feedResponse = await browser.tabs.sendMessage(tabId, { action: 'getFeedEntries' });
    setFeedCount(feedResponse.count ?? 0);
    setKudoCount(feedResponse.kudoCount ?? 0);
    browser.storage.local.set({ feedCount: feedResponse.count ?? 0 });

    const kudoResponse = await browser.tabs.sendMessage(tabId, { action: 'giveKudos' });
    if (kudoResponse?.success) {
      setKudosClicked(kudoResponse.totalClicked ?? 0);
      return;
    }

    throw new Error(kudoResponse?.error ?? 'Failed to give kudos');
  };

  const handleClick = async () => {
    setIsGivingKudos(true);
    setKudosClicked(0);

    try {
      const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });

      let targetTab: typeof activeTab | null | undefined = activeTab ?? null;
      if (activeTab?.url?.includes('strava.com')) {
        if (!activeTab.url.includes('strava.com/dashboard')) {
          targetTab = await browser.tabs.update(activeTab.id!, { url: 'https://www.strava.com/dashboard' });
          await waitForTabComplete(targetTab!.id!);
        }
      } else {
        targetTab = await browser.tabs.create({ url: 'https://www.strava.com/dashboard' });
        await waitForTabComplete(targetTab!.id!);
      }

      if (!targetTab?.id) {
        throw new Error('Unable to find target tab');
      }

      // Give the content script a brief moment to initialize after navigation.
      await new Promise((resolve) => setTimeout(resolve, 700));
      await runKudosOnTab(targetTab.id);
    } catch (error) {
      console.error('Error starting kudos process:', error);
    } finally {
      setIsGivingKudos(false);
    }
  };

  return (
    <div className="popup-container">
      <h1>KudoChronos</h1>
      {feedCount !== null && <h2>Feed entries: {feedCount}</h2>}
      {kudoCount !== null && <h2>Kudos available: {kudoCount}</h2>}
      {isGivingKudos && <h2>Giving kudos... {kudosClicked} clicked</h2>}
      {!isGivingKudos && kudosClicked > 0 && <h2>✓ Done! {kudosClicked} kudos given</h2>}
      <button onClick={handleClick} disabled={isGivingKudos}>
        {isGivingKudos ? 'Giving kudos...' : 'Give kudos!'}
      </button>
    </div>
  );
}

export default App;
