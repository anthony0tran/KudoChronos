import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['storage', 'notifications'],
    browser_specific_settings: {
      gecko: {
        id: 'kudochronos@anthony0tran',
      },
    },
  },
  runner: {
    binaries: {
      firefox: 'C:\\Program Files\\Firefox Developer Edition\\firefox.exe',
    },
    firefoxProfile: './.firefox-profile', // Persistent profile directory
    keepProfileChanges: true,
    startUrls: ['https://www.strava.com/dashboard'],
  },
});
