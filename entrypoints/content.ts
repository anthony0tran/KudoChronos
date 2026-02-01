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
    let totalClicked = 0;
    
    const giveKudosLoop = async () => {
      // Check if we've found filled kudos (already gave kudos to this activity)
      const filledKudos = document.querySelector('[data-testid="filled_kudos"]');
      if (filledKudos) {
        console.log('Found filled_kudos, stopping...');
        sendResponse({ success: true, totalClicked, stopped: true });
        return;
      }
      
      // Find all unfilled kudo buttons
      const unfilledButtons = document.querySelectorAll('[data-testid="unfilled_kudos"]');
      console.log(`Found ${unfilledButtons.length} unfilled kudos`);
      
      if (unfilledButtons.length === 0) {
        // No more unfilled kudos visible, scroll down to load more
        console.log('No unfilled kudos found, scrolling down...');
        window.scrollTo(0, document.body.scrollHeight);
        
        // Wait for content to load
        setTimeout(() => {
          const newButtons = document.querySelectorAll('[data-testid="unfilled_kudos"]');
          if (newButtons.length === 0) {
            // No new content loaded, we're done
            console.log('No more content to load, stopping...');
            sendResponse({ success: true, totalClicked, stopped: false });
          } else {
            // Continue with new content
            giveKudosLoop();
          }
        }, 2000);
        return;
      }
      
      // Click each unfilled kudo button with delay
      for (let i = 0; i < unfilledButtons.length; i++) {
        const button = unfilledButtons[i] as HTMLElement;
        console.log(`Clicking kudo ${i + 1}/${unfilledButtons.length}`);
        button.click();
        totalClicked++;
        
        // Wait before clicking next (rate limiting)
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      // After clicking all visible buttons, scroll and continue
      console.log('Scrolling to load more...');
      window.scrollTo(0, document.body.scrollHeight);
      
      // Wait for new content to load, then continue loop
      setTimeout(() => giveKudosLoop(), 2000);
    };
    
    giveKudosLoop();
    return true; // Keep channel open for async response
  }
  return true; // Keep channel open for async response
});
