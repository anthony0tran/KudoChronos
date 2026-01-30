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
      
      debugger;

      const feedEntries = document.querySelectorAll('[data-testid="web-feed-entry"]');
      console.log(`Found ${feedEntries.length} feed entries`);
      
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
      
      sendResponse({ success: true, count: feedEntries.length, entries });
    }, 1000);
  }
  return true; // Keep channel open for async response
});
