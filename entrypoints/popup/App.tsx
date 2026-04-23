import { browser } from 'wxt/browser';
import { useState, useEffect } from 'react';
import './App.css';

type KudosLedger = {
  totalKudosGiven: number;
  kudosByPerson: Record<string, number>;
};

const KUDOS_LEDGER_KEY = 'kudosLedger';

function App() {
  const [feedCount, setFeedCount] = useState<number | null>(null);
  const [kudoCount, setKudoCount] = useState<number | null>(null);
  const [kudosClicked, setKudosClicked] = useState<number>(0);
  const [isGivingKudos, setIsGivingKudos] = useState<boolean>(false);
  const [overallKudosTotal, setOverallKudosTotal] = useState<number>(0);
  const [kudosByPerson, setKudosByPerson] = useState<Record<string, number>>({});

  // Load feed count from storage on mount
  useEffect(() => {
    const loadKudosLedger = async () => {
      const result = await browser.storage.local.get(KUDOS_LEDGER_KEY);
      const raw = result[KUDOS_LEDGER_KEY] as Partial<KudosLedger> | undefined;

      setOverallKudosTotal(typeof raw?.totalKudosGiven === 'number' ? raw.totalKudosGiven : 0);
      setKudosByPerson(raw?.kudosByPerson && typeof raw.kudosByPerson === 'object' ? raw.kudosByPerson : {});
    };

    browser.storage.local.get('feedCount').then((result) => {
      console.log('Loaded from storage:', result);
      if (result.feedCount !== undefined && typeof result.feedCount === 'number') {
        setFeedCount(result.feedCount);
      }
    });

    loadKudosLedger();

    const onMessage = (message: any) => {
      if (message?.action === 'kudosProgress' && typeof message.clicked === 'number') {
        setKudosClicked(message.clicked);

        if (typeof message.overallTotal === 'number') {
          setOverallKudosTotal(message.overallTotal);
        }

        if (typeof message.personName === 'string' && typeof message.personTotal === 'number') {
          setKudosByPerson((prev) => ({
            ...prev,
            [message.personName]: message.personTotal,
          }));
        }
      }
    };

    browser.runtime.onMessage.addListener(onMessage);

    return () => {
      browser.runtime.onMessage.removeListener(onMessage);
    };
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

    const kudoResponse = await browser.tabs.sendMessage(tabId, { action: 'giveKudos', trackProgress: true });
    if (kudoResponse?.success) {
      setKudosClicked(kudoResponse.totalClicked ?? 0);

      const result = await browser.storage.local.get(KUDOS_LEDGER_KEY);
      const raw = result[KUDOS_LEDGER_KEY] as Partial<KudosLedger> | undefined;
      setOverallKudosTotal(typeof raw?.totalKudosGiven === 'number' ? raw.totalKudosGiven : 0);
      setKudosByPerson(raw?.kudosByPerson && typeof raw.kudosByPerson === 'object' ? raw.kudosByPerson : {});

      if (kudoResponse.stopped) {
        browser.notifications
          .create({
            type: 'basic',
            iconUrl: '/icon/96.png',
            title: 'KudoChronos finished',
            message: `Finished! Gave ${kudoResponse.totalClicked ?? 0} kudos!`,
          })
          .catch((error) => {
            console.error('Notification error:', error);
          });
      }

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

  const topRecipients = Object.entries(kudosByPerson)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="popup-container">
      <h1>KudoChronos</h1>
      <h2>Total kudos given: {overallKudosTotal}</h2>
      {feedCount !== null && <h2>Feed entries: {feedCount}</h2>}
      {kudoCount !== null && <h2>Kudos available: {kudoCount}</h2>}
      {isGivingKudos && <h2>Giving kudos... {kudosClicked} clicked</h2>}
      {!isGivingKudos && kudosClicked > 0 && <h2>✓ Done! {kudosClicked} kudos given</h2>}
      {topRecipients.length > 0 && (
        <div>
          <h2>Top recipients</h2>
          <ul>
            {topRecipients.map(([name, count]) => (
              <li key={name}>
                {name}: {count}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button onClick={handleClick} disabled={isGivingKudos}>
        {isGivingKudos ? 'Giving kudos...' : 'Give kudos!'}
      </button>
    </div>
  );
}

export default App;
