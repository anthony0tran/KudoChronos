import {browser} from 'wxt/browser';
import type {FeedEntriesResponse, GiveKudosResponse} from './types';

export async function getFeedEntries(tabId: number): Promise<FeedEntriesResponse> {
    return (await browser.tabs.sendMessage(tabId, {action: 'getFeedEntries'})) as FeedEntriesResponse;
}

export async function giveKudos(tabId: number): Promise<GiveKudosResponse> {
    return (await browser.tabs.sendMessage(tabId, {
        action: 'giveKudos',
        trackProgress: true,
    })) as GiveKudosResponse;
}

export async function notifyFinished(totalClicked: number) {
    try {
        await browser.notifications.create({
            type: 'basic',
            iconUrl: '/icon/96.png',
            title: 'KudoChronos finished',
            message: `Finished! Gave ${totalClicked} kudos!`,
        });
    } catch (error) {
        console.error('Notification error:', error);
    }
}

