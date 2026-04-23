type KudosRunResult = {
  success: boolean;
  totalClicked: number;
  stopped: boolean;
  error?: string;
};

let isRunning = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const INITIAL_PAGE_SETTLE_MS = 1500;
const CLICK_PAUSE_MS = 2500;
const SCROLL_LOAD_WAIT_MS = 3000;

function clickElement(el: HTMLElement) {
  el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
  el.click();
}

async function runKudosProcess(): Promise<KudosRunResult> {
  if (isRunning) {
    return { success: false, totalClicked: 0, stopped: false, error: 'KudoChronos is already running.' };
  }

  isRunning = true;

  try {
    const processedEntries = new WeakSet<Element>();

    let totalClicked = 0;
    let consecutiveFilled = 0;
    let idleScrolls = 0;
    const MAX_CONSECUTIVE_FILLED = 10;
    const MAX_IDLE_SCROLLS = 3;

    // Always start from the top of the feed.
    window.scrollTo({ top: 0, behavior: 'auto' });
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
          const kudosButton =
            (unfilledKudos.closest('button') as HTMLElement | null) ??
            (entry.querySelector('[data-testid="kudos_button"]') as HTMLElement | null);

          if (kudosButton) {
            kudosButton.scrollIntoView({ block: 'center', behavior: 'auto' });
            await sleep(300);

            clickElement(kudosButton);
            await sleep(800);

            // Retry once if Strava didn't toggle state.
            const stillUnfilled = !!entry.querySelector('[data-testid="unfilled_kudos"]');
            if (stillUnfilled) {
              clickElement(kudosButton);
              await sleep(800);
            }
          }

          const nowFilled = !!entry.querySelector('[data-testid="filled_kudos"]');
          if (nowFilled) {
            totalClicked++;
            consecutiveFilled = 0;
          }

          await sleep(CLICK_PAUSE_MS);
          continue;
        }

        if (filledKudos) {
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

        window.scrollBy({ top: Math.floor(window.innerHeight * 0.9), behavior: 'auto' });
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
      stopped: consecutiveFilled >= 10,
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
    runKudosProcess().then((result) => {
      sendResponse(result);
    });

    return true; // Keep channel open for async response
  }
  return true; // Keep channel open for async response
});
