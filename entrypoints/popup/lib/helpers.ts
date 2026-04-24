import type {KudosLedger, KudosProgressMessage, KudosRunEntry} from './types';

export function parseKudosLedger(raw: unknown): KudosLedger {
    const ledger = raw as Partial<KudosLedger> | undefined;
    const totalKudosGiven = typeof ledger?.totalKudosGiven === 'number' ? ledger.totalKudosGiven : 0;
    const kudosByPerson: Record<string, number> = {};
    const history: KudosRunEntry[] = [];

    if (ledger?.kudosByPerson && typeof ledger.kudosByPerson === 'object') {
        for (const [name, count] of Object.entries(ledger.kudosByPerson as Record<string, unknown>)) {
            if (typeof count === 'number') {
                kudosByPerson[name] = count;
            }
        }
    }

    if (Array.isArray(ledger?.history)) {
        for (const entry of ledger.history as unknown[]) {
            const e = entry as Partial<KudosRunEntry>;
            if (
                e &&
                typeof e.timestamp === 'string' &&
                typeof e.kudosGiven === 'number' &&
                Array.isArray(e.recipients)
            ) {
                history.push({
                    timestamp: e.timestamp,
                    kudosGiven: e.kudosGiven,
                    recipients: (e.recipients as unknown[]).filter((r): r is string => typeof r === 'string'),
                });
            }
        }
    }

    return {totalKudosGiven, kudosByPerson, history};
}

export function isKudosProgressMessage(message: unknown): message is KudosProgressMessage {
    return (
        typeof message === 'object' &&
        message !== null &&
        (message as {action?: string}).action === 'kudosProgress' &&
        typeof (message as {clicked?: unknown}).clicked === 'number'
    );
}

