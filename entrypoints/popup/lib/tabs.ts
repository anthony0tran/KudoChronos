import {browser} from 'wxt/browser';
import {STRAVA_DASHBOARD_URL} from './constants';

export async function waitForTabComplete(tabId: number) {
    const currentTab = await browser.tabs.get(tabId);
    if (currentTab.status === 'complete') {
        return;
    }

    await new Promise<void>((resolve) => {
        const listener = (updatedTabId: number, changeInfo: {status?: string}) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                browser.tabs.onUpdated.removeListener(listener);
                resolve();
            }
        };

        browser.tabs.onUpdated.addListener(listener);
    });
}

export async function resolveDashboardTabId(): Promise<number> {
    const [activeTab] = await browser.tabs.query({active: true, currentWindow: true});

    if (activeTab?.url?.includes('strava.com')) {
        if (activeTab.url.includes('strava.com/dashboard') && typeof activeTab.id === 'number') {
            return activeTab.id;
        }

        if (typeof activeTab.id === 'number') {
            const updatedTab = await browser.tabs.update(activeTab.id, {url: STRAVA_DASHBOARD_URL});
            if (!updatedTab || typeof updatedTab.id !== 'number') {
                throw new Error('Unable to resolve Strava dashboard tab');
            }

            await waitForTabComplete(updatedTab.id);
            return updatedTab.id;
        }
    }

    const createdTab = await browser.tabs.create({url: STRAVA_DASHBOARD_URL});
    if (typeof createdTab.id !== 'number') {
        throw new Error('Unable to create Strava dashboard tab');
    }

    await waitForTabComplete(createdTab.id);
    return createdTab.id;
}

