# 👊 KudoChronos

**Never miss giving a fist bump again.**  
KudoChronos is a Firefox extension that automatically scrolls your Strava feed and gives kudos to every athlete — so you can show your support for the whole crew with a single click. It's smart enough to stop when it reaches activities you've already reacted to, so it never double-kudos anyone or wastes your time.

Open the popup, hit **Give kudos**, and watch the counter climb. When it's done, check the **Dashboard** to see your lifetime kudos total, your top recipients, and a full history of every run.

## ✨ Features

- **One-click kudos** — processes your entire Strava feed automatically
- **Smart-stop logic** — halts after a streak of already-kudosed activities, so it never re-processes old content
- **Live progress counter** — see kudos being given in real time while the extension works
- **Lifetime stats** — tracks total kudos given, kudos per person, and a timestamped run history
- **Top recipients** — see at a glance who you cheer for the most
- **Export & import** — back up your stats as JSON and restore them anytime
- **Skips your own activities** — won't kudos yourself

---

## 🛠 Technical Specs

| | |
|---|---|
| **Platform** | Firefox (Manifest V2 via WXT) |
| **Framework** | [WXT](https://wxt.dev/) `v0.20` — zero-config web extension tooling |
| **UI** | React `19` + TypeScript |
| **Build** | Vite (via WXT), TypeScript `6` |
| **Storage** | `browser.storage.local` — persists a kudos ledger (`totalKudosGiven`, `kudosByPerson`, `history`) |
| **Permissions** | `storage`, `notifications` |

### Architecture

```
entrypoints/
├── background.ts       # Service worker — sends desktop notifications on completion
├── content.ts          # Content script injected on *.strava.com — owns all DOM interaction
└── popup/              # React SPA — popup UI with Home and Dashboard tabs
    ├── App.tsx
    └── lib/
        ├── constants.ts   # Storage key names
        ├── helpers.ts     # Type guards & ledger parsing
        ├── kudos.ts       # Messaging helpers (getFeedEntries, giveKudos, notifyFinished)
        ├── tabs.ts        # Resolves the active Strava dashboard tab ID
        └── types.ts       # Shared TypeScript types (KudosLedger, KudosRunEntry)
```

### Content script scroll algorithm

1. Scrolls to the top of the feed and waits for the DOM to settle.
2. Iterates over `[data-testid="web-feed-entry"]` elements using a `WeakSet` to track already-processed entries — each entry is visited exactly once per run.
3. For each entry with an `[data-testid="unfilled_kudos"]` button, it dispatches `pointerdown → mousedown → mouseup → click` events to reliably trigger Strava's React handlers, with a built-in retry if the state didn't toggle.
4. Tracks a **consecutive-filled counter** — after 20 consecutive already-kudosed entries, the run stops (the "smart stop"). Also stops after 5 idle scrolls where no new content loads.
5. Progress is streamed back to the popup via `browser.runtime.sendMessage` so the counter updates live.

### Kudos ledger schema

```jsonc
{
  "totalKudosGiven": 412,
  "kudosByPerson": { "Jane Doe": 18, "John Smith": 7 },
  "history": [
    {
      "timestamp": "2026-04-26T10:30:00.000Z",
      "kudosGiven": 14,
      "recipients": ["Jane Doe", "John Smith"]
    }
  ]
}
```

### Dev setup

```bash
npm install
npm run dev      # Launches Firefox Developer Edition with the extension hot-reloaded
npm run build    # Production build
npm run xpi      # Packages a signed-ready .xpi for distribution
```

> Requires Firefox Developer Edition at the default install path (configurable in `wxt.config.ts`).
