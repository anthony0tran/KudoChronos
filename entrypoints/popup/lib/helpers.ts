import type {KudosLedger, KudosProgressMessage} from './types';

export function parseKudosLedger(raw: unknown): KudosLedger {
    const ledger = raw as Partial<KudosLedger> | undefined;
    const totalKudosGiven = typeof ledger?.totalKudosGiven === 'number' ? ledger.totalKudosGiven : 0;
    const kudosByPerson: Record<string, number> = {};

    if (ledger?.kudosByPerson && typeof ledger.kudosByPerson === 'object') {
        for (const [name, count] of Object.entries(ledger.kudosByPerson as Record<string, unknown>)) {
            if (typeof count === 'number') {
                kudosByPerson[name] = count;
            }
        }
    }

    return {totalKudosGiven, kudosByPerson};
}

export function isKudosProgressMessage(message: unknown): message is KudosProgressMessage {
    return (
        typeof message === 'object' &&
        message !== null &&
        (message as {action?: string}).action === 'kudosProgress' &&
        typeof (message as {clicked?: unknown}).clicked === 'number'
    );
}

