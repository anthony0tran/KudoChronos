import {browser} from 'wxt/browser';
import {useEffect, useMemo, useState} from 'react';
import './App.css';
import {FEED_COUNT_KEY, KUDOS_LEDGER_KEY} from './lib/constants';
import {isKudosProgressMessage, parseKudosLedger} from './lib/helpers';
import {getFeedEntries, giveKudos, notifyFinished} from './lib/kudos';
import {resolveDashboardTabId} from './lib/tabs';

function App() {
    const [feedCount, setFeedCount] = useState<number | null>(null);
    const [kudoCount, setKudoCount] = useState<number | null>(null);
    const [kudosClicked, setKudosClicked] = useState<number>(0);
    const [isGivingKudos, setIsGivingKudos] = useState<boolean>(false);
    const [overallKudosTotal, setOverallKudosTotal] = useState<number>(0);
    const [kudosByPerson, setKudosByPerson] = useState<Record<string, number>>({});

    const refreshKudosLedger = async () => {
        const result = await browser.storage.local.get(KUDOS_LEDGER_KEY);
        const ledger = parseKudosLedger(result[KUDOS_LEDGER_KEY]);
        setOverallKudosTotal(ledger.totalKudosGiven);
        setKudosByPerson(ledger.kudosByPerson);
    };

    const loadFeedCount = async () => {
        const result = await browser.storage.local.get(FEED_COUNT_KEY);
        if (typeof result[FEED_COUNT_KEY] === 'number') {
            setFeedCount(result[FEED_COUNT_KEY]);
        }
    };

    useEffect(() => {
        loadFeedCount().catch((error) => {
            console.error('Failed to load feed count:', error);
        });

        refreshKudosLedger().catch((error) => {
            console.error('Failed to load kudos ledger:', error);
        });

        const onMessage = (message: unknown) => {
            if (!isKudosProgressMessage(message)) {
                return;
            }

            setKudosClicked(message.clicked);

            if (typeof message.overallTotal === 'number') {
                setOverallKudosTotal(message.overallTotal);
            }

            if (typeof message.personName === 'string' && typeof message.personTotal === 'number') {
                const personName = message.personName;
                const personTotal = message.personTotal;
                setKudosByPerson((prev) => ({
                    ...prev,
                    [personName]: personTotal,
                }));
            }
        };

        browser.runtime.onMessage.addListener(onMessage);

        return () => {
            browser.runtime.onMessage.removeListener(onMessage);
        };
    }, []);

    const runKudosOnTab = async (tabId: number) => {
        const feedResponse = await getFeedEntries(tabId);
        setFeedCount(feedResponse.count ?? 0);
        setKudoCount(feedResponse.kudoCount ?? 0);
        await browser.storage.local.set({[FEED_COUNT_KEY]: feedResponse.count ?? 0});

        const kudoResponse = await giveKudos(tabId);

        if (kudoResponse?.success) {
            setKudosClicked(kudoResponse.totalClicked ?? 0);

            await refreshKudosLedger();

            if (kudoResponse.stopped) {
                await notifyFinished(kudoResponse.totalClicked ?? 0);
            }

            return;
        }

        throw new Error(kudoResponse?.error ?? 'Failed to give kudos');
    };

    const handleClick = async () => {
        setIsGivingKudos(true);
        setKudosClicked(0);

        try {
            const tabId = await resolveDashboardTabId();

            // Give the content script a brief moment to initialize after navigation.
            await new Promise((resolve) => setTimeout(resolve, 700));
            await runKudosOnTab(tabId);
        } catch (error) {
            console.error('Error starting kudos process:', error);
        } finally {
            setIsGivingKudos(false);
        }
    };

    const topRecipients = useMemo(
        () =>
            Object.entries(kudosByPerson)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5),
        [kudosByPerson],
    );

    return (
        <div className="popup-container">
            <header className="popup-header">
                <p className="app-name">KudoChronos</p>
                <p className="app-subtitle">Session stats</p>
            </header>

            <section className="stats-grid">
                <article className="stat-card stat-card-primary">
                    <p className="stat-label">Total kudos given</p>
                    <p className="stat-value">{overallKudosTotal}</p>
                </article>

                {feedCount !== null && (
                    <article className="stat-card">
                        <p className="stat-label">Feed entries</p>
                        <p className="stat-value">{feedCount}</p>
                    </article>
                )}

                {kudoCount !== null && (
                    <article className="stat-card">
                        <p className="stat-label">Kudos available</p>
                        <p className="stat-value">{kudoCount}</p>
                    </article>
                )}
            </section>

            <section className="status-panel" aria-live="polite">
                {isGivingKudos && <p>Giving kudos... {kudosClicked} clicked</p>}
                {!isGivingKudos && kudosClicked > 0 && <p>Done. {kudosClicked} kudos given.</p>}
                {!isGivingKudos && kudosClicked === 0 && <p>Ready to run on your Strava dashboard.</p>}
            </section>

            {topRecipients.length > 0 && (
                <section className="recipients-panel">
                    <h2>Top recipients</h2>
                    <ul>
                        {topRecipients.map(([name, count]) => (
                            <li key={name}>
                                <span>{name}</span>
                                <strong>{count}</strong>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <button className="primary-action" onClick={handleClick} disabled={isGivingKudos}>
                {isGivingKudos ? 'Giving kudos...' : 'Give kudos'}
            </button>
        </div>
    );
}

export default App;
