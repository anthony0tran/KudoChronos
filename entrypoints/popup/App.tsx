import {browser} from 'wxt/browser';
import {useEffect, useMemo, useRef, useState} from 'react';
import './App.css';
import {FEED_COUNT_KEY, KUDOS_LEDGER_KEY} from './lib/constants';
import {isKudosProgressMessage, parseKudosLedger} from './lib/helpers';
import {getFeedEntries, giveKudos, notifyFinished} from './lib/kudos';
import {resolveDashboardTabId} from './lib/tabs';
import type {KudosLedger, KudosRunEntry} from './lib/types';

type ViewTab = 'home' | 'dashboard';

function formatTimestamp(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function App() {
    const [activeTab, setActiveTab] = useState<ViewTab>('home');
    const [feedCount, setFeedCount] = useState<number | null>(null);
    const [kudoCount, setKudoCount] = useState<number | null>(null);
    const [kudosClicked, setKudosClicked] = useState<number>(0);
    const [isGivingKudos, setIsGivingKudos] = useState<boolean>(false);
    const [overallKudosTotal, setOverallKudosTotal] = useState<number>(0);
    const [kudosByPerson, setKudosByPerson] = useState<Record<string, number>>({});
    const [history, setHistory] = useState<KudosRunEntry[]>([]);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
    const [showAllRecipients, setShowAllRecipients] = useState<boolean>(false);
    const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const recipientsRef = useRef<string[]>([]);

    const toggleExpanded = (index: number) => {
        setExpandedItems((prev) => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const refreshKudosLedger = async () => {
        const result = await browser.storage.local.get(KUDOS_LEDGER_KEY);
        const ledger = parseKudosLedger(result[KUDOS_LEDGER_KEY]);
        setOverallKudosTotal(ledger.totalKudosGiven);
        setKudosByPerson(ledger.kudosByPerson);
        setHistory([...ledger.history].reverse()); // newest first
    };

    const loadFeedCount = async () => {
        const result = await browser.storage.local.get(FEED_COUNT_KEY);
        if (typeof result[FEED_COUNT_KEY] === 'number') {
            setFeedCount(result[FEED_COUNT_KEY]);
        }
    };

    useEffect(() => {
        Promise.all([
            loadFeedCount().catch(console.error),
            refreshKudosLedger().catch(console.error),
        ]).finally(() => setIsLoading(false));

        const onMessage = (message: unknown) => {
            if (!isKudosProgressMessage(message)) return;
            setKudosClicked(message.clicked);
            if (typeof message.overallTotal === 'number') setOverallKudosTotal(message.overallTotal);
            if (typeof message.personName === 'string' && typeof message.personTotal === 'number') {
                const personName = message.personName;
                const personTotal = message.personTotal;
                setKudosByPerson((prev) => ({...prev, [personName]: personTotal}));
                recipientsRef.current.push(personName);
            }
        };

        browser.runtime.onMessage.addListener(onMessage);
        return () => browser.runtime.onMessage.removeListener(onMessage);
    }, []);

    const saveRunToHistory = async (kudosGiven: number, recipients: string[]) => {
        if (kudosGiven === 0) return;
        const result = await browser.storage.local.get(KUDOS_LEDGER_KEY);
        const existing = (result[KUDOS_LEDGER_KEY] ?? {}) as Record<string, unknown>;
        const historyArr = Array.isArray(existing.history) ? existing.history : [];
        const entry: KudosRunEntry = {
            timestamp: new Date().toISOString(),
            kudosGiven,
            recipients: [...new Set(recipients)],
        };
        await browser.storage.local.set({
            [KUDOS_LEDGER_KEY]: {...existing, history: [...historyArr, entry]},
        });
        setHistory((prev) => [entry, ...prev]);
    };

    const runKudosOnTab = async (tabId: number): Promise<number> => {
        const feedResponse = await getFeedEntries(tabId);
        setFeedCount(feedResponse.count ?? 0);
        setKudoCount(feedResponse.kudoCount ?? 0);
        await browser.storage.local.set({[FEED_COUNT_KEY]: feedResponse.count ?? 0});

        const kudoResponse = await giveKudos(tabId);

        if (kudoResponse?.success) {
            const clicked = kudoResponse.totalClicked ?? 0;
            setKudosClicked(clicked);
            await refreshKudosLedger();
            if (kudoResponse.stopped) await notifyFinished(clicked);
            return clicked;
        }

        throw new Error(kudoResponse?.error ?? 'Failed to give kudos');
    };

    const handleClick = async () => {
        setIsGivingKudos(true);
        setKudosClicked(0);
        recipientsRef.current = [];

        try {
            const tabId = await resolveDashboardTabId();
            await new Promise((resolve) => setTimeout(resolve, 700));
            const clicked = await runKudosOnTab(tabId);
            if (clicked > 0) {
                await saveRunToHistory(clicked, recipientsRef.current);
            }
        } catch (error) {
            console.error('Error starting kudos process:', error);
        } finally {
            setIsGivingKudos(false);
        }
    };

    const handleExport = async () => {
        const result = await browser.storage.local.get(KUDOS_LEDGER_KEY);
        const ledger = parseKudosLedger(result[KUDOS_LEDGER_KEY]);
        const blob = new Blob([JSON.stringify(ledger, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kudochronos-stats-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const processImportText = async (text: string) => {
        setImportStatus('idle');
        try {
            const raw: unknown = JSON.parse(text);
            const ledger: KudosLedger = parseKudosLedger(raw);
            await browser.storage.local.set({[KUDOS_LEDGER_KEY]: ledger});
            setOverallKudosTotal(ledger.totalKudosGiven);
            setKudosByPerson(ledger.kudosByPerson);
            setHistory([...ledger.history].reverse());
            setImportStatus('success');
        } catch {
            setImportStatus('error');
        }
    };

    const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const text = e.clipboardData.getData('text');
        if (text) await processImportText(text);
    };

    const handleAbout = () => {
        browser.tabs.create({url: 'https://github.com/anthony0tran/KudoChronos'}).catch(console.error);
    };

    const topRecipients = useMemo(
        () => Object.entries(kudosByPerson).sort((a, b) => b[1] - a[1]),
        [kudosByPerson],
    );

    const visibleRecipients = showAllRecipients ? topRecipients : topRecipients.slice(0, 5);

    return (
        <div className="popup-container">
            {isLoading ? (
                <div className="loading-screen" aria-label="Loading">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                </div>
            ) : (
            <>
                <header className="popup-header">
                    <p className="app-name">KudoChronos</p>
                    <div className="header-actions">
                        <nav className="view-tabs" role="tablist">
                            <button
                                role="tab"
                                aria-selected={activeTab === 'home'}
                                className={`view-tab${activeTab === 'home' ? ' view-tab-active' : ''}`}
                                onClick={() => setActiveTab('home')}
                            >
                                Home
                            </button>
                            <button
                                role="tab"
                                aria-selected={activeTab === 'dashboard'}
                                className={`view-tab${activeTab === 'dashboard' ? ' view-tab-active' : ''}`}
                                onClick={() => setActiveTab('dashboard')}
                            >
                                Dashboard
                            </button>
                        </nav>
                        <button
                            className="about-btn"
                            onClick={handleAbout}
                            title="View on GitHub"
                            aria-label="About KudoChronos on GitHub"
                        >
                            About
                        </button>
                    </div>
                </header>

            {activeTab === 'home' && (
                <>
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
                        {isGivingKudos && <p>Giving kudos… {kudosClicked} clicked</p>}
                        {!isGivingKudos && kudosClicked > 0 && <p>Done. {kudosClicked} kudos given.</p>}
                        {!isGivingKudos && kudosClicked === 0 && <p>Ready to run on your Strava dashboard.</p>}
                    </section>

                    {topRecipients.length > 0 && (
                        <section
                            className={`recipients-panel${topRecipients.length > 5 ? ' recipients-panel-expandable' : ''}`}
                            onClick={topRecipients.length > 5 ? () => setShowAllRecipients((v) => !v) : undefined}
                            aria-expanded={topRecipients.length > 5 ? showAllRecipients : undefined}
                        >
                            <h2>
                                Top recipients
                            </h2>
                            <ul>
                                {visibleRecipients.map(([name, count]) => (
                                    <li key={name}>
                                        <span>{name}</span>
                                        <strong>{count}</strong>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    <button className="primary-action" onClick={handleClick} disabled={isGivingKudos}>
                        {isGivingKudos ? 'Giving kudos…' : 'Give kudos'}
                    </button>
                </>
            )}

            {activeTab === 'dashboard' && (
                <>
                    <section className="stats-grid">
                        <article className="stat-card stat-card-primary">
                            <p className="stat-label">Total kudos given</p>
                            <p className="stat-value">{overallKudosTotal}</p>
                        </article>
                        <article className="stat-card">
                            <p className="stat-label">Total runs</p>
                            <p className="stat-value">{history.length}</p>
                        </article>
                        <article className="stat-card">
                            <p className="stat-label">Unique recipients</p>
                            <p className="stat-value">{Object.keys(kudosByPerson).length}</p>
                        </article>
                    </section>

                    <section className="history-panel">
                        <h2>Run history</h2>
                        {history.length === 0 ? (
                            <p className="history-empty">No runs recorded yet. Give some kudos first!</p>
                        ) : (
                            <ul className="history-list">
                                {history.map((entry, i) => {
                                    const isExpanded = expandedItems.has(i);
                                    const hasMore = entry.recipients.length > 3;
                                    const preview = entry.recipients.slice(0, 3).join(', ');
                                    const extra = entry.recipients.length - 3;
                                    return (
                                        <li
                                            key={i}
                                            className={`history-item${hasMore ? ' history-item-expandable' : ''}`}
                                            onClick={hasMore ? () => toggleExpanded(i) : undefined}
                                            aria-expanded={hasMore ? isExpanded : undefined}
                                        >
                                            <div className="history-item-header">
                                                <span className="history-timestamp">{formatTimestamp(entry.timestamp)}</span>
                                                <span className="history-badge">{entry.kudosGiven} kudos</span>
                                            </div>
                                            {entry.recipients.length > 0 && (
                                                <p className="history-recipients">
                                                    {isExpanded
                                                        ? entry.recipients.join(', ')
                                                        : <>
                                                            {preview}
                                                            {hasMore && (
                                                                <span className="history-more"> &amp; {extra} more</span>
                                                            )}
                                                        </>
                                                    }
                                                </p>
                                            )}
                                            {hasMore && (
                                                <span className="history-expand-hint">
                                                    {isExpanded ? '▲ show less' : '▼ show all'}
                                                </span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <section className="data-panel" aria-label="Export and import statistics">
                        <h2>Data</h2>
                        <div className="data-actions">
                            <button className="data-btn" onClick={handleExport} aria-label="Export statistics as JSON">
                                ↓ Export
                            </button>
                        </div>
                        <textarea
                            className="paste-zone"
                            placeholder="↑ Import: paste exported JSON here"
                            rows={2}
                            value=""
                            onChange={() => {}}
                            onPaste={handlePaste}
                            aria-label="Paste exported JSON to import"
                            spellCheck={false}
                        />
                        {importStatus === 'success' && (
                            <p className="data-status data-status-success" role="status">
                                Stats imported successfully.
                            </p>
                        )}
                        {importStatus === 'error' && (
                            <p className="data-status data-status-error" role="alert">
                                Invalid JSON. Please paste a valid KudoChronos export.
                            </p>
                        )}
                    </section>
                </>
            )}
            </>
            )}
        </div>
    );
}

export default App;
