export type KudosLedger = {
    totalKudosGiven: number;
    kudosByPerson: Record<string, number>;
};

export type KudosProgressMessage = {
    action: 'kudosProgress';
    clicked: number;
    overallTotal?: number;
    personName?: string;
    personTotal?: number;
};

export type FeedEntriesResponse = {
    count?: number;
    kudoCount?: number;
};

export type GiveKudosResponse = {
    success?: boolean;
    totalClicked?: number;
    stopped?: boolean;
    error?: string;
};

