type KudosRunResult = {
    success: boolean;
    totalClicked: number;
    stopped: boolean;
    error?: string;
};

type KudosLedger = {
    totalKudosGiven: number;
    kudosByPerson: Record<string, number>;
    // history is owned by the popup; preserved here but not modified
    [key: string]: unknown;
};

type ProgressPayload = {
    clicked: number;
    personName: string;
    overallTotal: number;
    personTotal: number;
};

let isRunning = false;
const KUDOS_LEDGER_KEY = 'kudosLedger';
const OWN_NAME_TO_SKIP = 'Anthony Tran';

const sleep = (ms: number) =>
    new Promise((resolve) =>
        setTimeout(resolve, ms));

const INITIAL_PAGE_SETTLE_MS = 1500;
const CLICK_PAUSE_MS = 2500;
const SCROLL_LOAD_WAIT_MS = 3000;

function clickElement(el: HTMLElement) {
    el.dispatchEvent(new MouseEvent('pointerdown', {bubbles: true, cancelable: true}));
    el.dispatchEvent(new MouseEvent('mousedown', {bubbles: true, cancelable: true}));
    el.dispatchEvent(new MouseEvent('mouseup', {bubbles: true, cancelable: true}));
    el.click();
}

function getOwnerNameFromEntry(entry: Element): string {
    const ownerNameEl = entry.querySelector('[data-testid="owners-name"]') as HTMLElement | null;
    const rawName = ownerNameEl?.textContent?.trim();
    return rawName && rawName.length > 0 ? rawName : 'Unknown athlete';
}

async function getKudosLedger(): Promise<KudosLedger> {
    const result = await browser.storage.local.get(KUDOS_LEDGER_KEY);
    const raw = (result[KUDOS_LEDGER_KEY] ?? {}) as KudosLedger;

    const totalKudosGiven = typeof raw.totalKudosGiven === 'number' ? raw.totalKudosGiven : 0;
    const kudosByPerson: Record<string, number> = {};

    if (raw.kudosByPerson && typeof raw.kudosByPerson === 'object') {
        for (const [name, count] of Object.entries(raw.kudosByPerson as Record<string, unknown>)) {
            if (typeof count === 'number') kudosByPerson[name] = count;
        }
    }

    // Spread the entire raw object so unknown fields (e.g. history) are preserved.
    return {...raw, totalKudosGiven, kudosByPerson};
}

async function persistKudo(personName: string): Promise<{ overallTotal: number; personTotal: number }> {
    const ledger = await getKudosLedger();
    ledger.totalKudosGiven += 1;
    ledger.kudosByPerson[personName] = (ledger.kudosByPerson[personName] ?? 0) + 1;

    await browser.storage.local.set({[KUDOS_LEDGER_KEY]: ledger});

    return {
        overallTotal: ledger.totalKudosGiven,
        personTotal: ledger.kudosByPerson[personName],
    };
}

async function runKudosProcess(onProgress?: (payload: ProgressPayload) => void): Promise<KudosRunResult> {
    if (isRunning) {
        return {success: false, totalClicked: 0, stopped: false, error: 'KudoChronos is already running.'};
    }

    isRunning = true;

    try {
        const processedEntries = new WeakSet<Element>();

        let totalClicked = 0;
        let consecutiveFilled = 0;
        let idleScrolls = 0;
        let hasStarted = false;
        const MAX_CONSECUTIVE_FILLED = 10;
        const MAX_IDLE_SCROLLS = 3;

        // Always start from the top of the feed.
        window.scrollTo({top: 0, behavior: 'auto'});
        await sleep(INITIAL_PAGE_SETTLE_MS);

        while (consecutiveFilled < MAX_CONSECUTIVE_FILLED) {
            const feedEntries = Array.from(document.querySelectorAll('[data-testid="web-feed-entry"]'));
            let processedThisPass = false;

            for (const entry of feedEntries) {
                if (processedEntries.has(entry)) {
                    continue;
                }

                processedEntries.add(entry);
                processedThisPass = true;

                const unfilledKudos = entry.querySelector('[data-testid="unfilled_kudos"]') as HTMLElement | null;
                const filledKudos = entry.querySelector('[data-testid="filled_kudos"]');

                if (unfilledKudos) {
                    const personName = getOwnerNameFromEntry(entry);
                    if (personName === OWN_NAME_TO_SKIP) {
                        continue;
                    }

                    // Only click the exact button wrapping the unfilled icon.
                    const kudosButton = unfilledKudos.closest('button') as HTMLElement | null;

                    if (kudosButton) {
                        if (!hasStarted) {
                            hasStarted = true;
                        }

                        kudosButton.scrollIntoView({block: 'center', behavior: 'auto'});
                        await sleep(300);

                        clickElement(kudosButton);
                        await sleep(800);

                        // Retry once if Strava didn't toggle state.
                        const stillUnfilled = !!entry.querySelector('[data-testid="unfilled_kudos"]');
                        if (stillUnfilled) {
                            clickElement(kudosButton);
                            await sleep(800);
                        }

                        const nowFilled = !!entry.querySelector('[data-testid="filled_kudos"]');
                        if (nowFilled) {
                            totalClicked++;
                            consecutiveFilled = 0;
                            const {overallTotal, personTotal} = await persistKudo(personName);
                            onProgress?.({
                                clicked: totalClicked,
                                personName,
                                overallTotal,
                                personTotal,
                            });
                        }
                    }

                    await sleep(CLICK_PAUSE_MS);
                    continue;
                }

                if (hasStarted && filledKudos) {
                    consecutiveFilled++;
                    if (consecutiveFilled >= MAX_CONSECUTIVE_FILLED) {
                        break;
                    }
                }
            }

            if (consecutiveFilled >= MAX_CONSECUTIVE_FILLED) {
                break;
            }

            if (!processedThisPass) {
                const previousEntryCount = feedEntries.length;
                const previousHeight = document.body.scrollHeight;

                window.scrollBy({top: Math.floor(window.innerHeight * 0.9), behavior: 'auto'});
                await sleep(SCROLL_LOAD_WAIT_MS);

                const nextEntryCount = document.querySelectorAll('[data-testid="web-feed-entry"]').length;
                const nextHeight = document.body.scrollHeight;

                if (nextEntryCount === previousEntryCount && nextHeight === previousHeight) {
                    idleScrolls++;
                } else {
                    idleScrolls = 0;
                }

                if (idleScrolls >= MAX_IDLE_SCROLLS) {
                    break;
                }
            }
        }

        return {
            success: true,
            totalClicked,
            stopped: hasStarted && consecutiveFilled >= 10,
        };
    } catch (error) {
        return {
            success: false,
            totalClicked: 0,
            stopped: false,
            error: String(error),
        };
    } finally {
        isRunning = false;
    }
}

export default defineContentScript({
    matches: ['*://*.strava.com/*'],
    main() {
        console.log('KudoChronos content script loaded on Strava');
    },
});

// Listen for messages from popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getFeedEntries') {
        // Add a small delay to ensure DOM is fully loaded
        setTimeout(() => {
            console.log('Searching for feed entries...');
            console.log('Document ready state:', document.readyState);

            const feedEntries = document.querySelectorAll('[data-testid="web-feed-entry"]');
            console.log(`Found ${feedEntries.length} feed entries`);

            // Find kudo buttons within the loaded entries
            const kudoButtons = document.querySelectorAll('[data-testid="unfilled_kudos"]');
            console.log(`Found ${kudoButtons.length} kudo buttons`);

            // Log the first few elements to debug
            if (feedEntries.length === 0) {
                console.log('No feed entries found. Checking for similar elements...');
                const allWithTestId = document.querySelectorAll('[data-testid]');
                console.log(`Total elements with data-testid: ${allWithTestId.length}`);
                const first5 = Array.from(allWithTestId).slice(0, 5);
                first5.forEach(el => console.log('data-testid:', el.getAttribute('data-testid')));
            }

            // Convert NodeList to array - only send serializable data, not DOM elements
            const entries = Array.from(feedEntries).map((entry) => ({
                index: entry.getAttribute('index'),
                className: entry.className
            }));

            sendResponse({
                success: true,
                count: feedEntries.length,
                kudoCount: kudoButtons.length,
                entries
            });
        }, 1000);
    }

    if (message.action === 'giveKudos') {
        runKudosProcess((payload) => {
            if (message.trackProgress) {
                browser.runtime
                    .sendMessage({action: 'kudosProgress', ...payload})
                    .catch(() => {
                        // Popup may be closed; ignore message delivery failures.
                    });
            }
        }).then((result) => {
            sendResponse(result);
        });

        return true; // Keep channel open for async response
    }
    return true; // Keep channel open for async response
});
