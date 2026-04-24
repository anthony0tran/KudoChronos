import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['storage', 'notifications'],
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
    action: {
      default_icon: {
        16: '/icon/16.png',
        32: '/icon/32.png',
        48: '/icon/48.png',
        96: '/icon/96.png',
        128: '/icon/128.png',
      },
    },
    browser_specific_settings: {
      gecko: {
        id: 'kudochronos@anthony0tran',
      },
    },
  },
  webExt: {
    binaries: {
      firefox: 'C:\\Program Files\\Firefox Developer Edition\\firefox.exe',
    },
    firefoxProfile: './.firefox-profile',
    keepProfileChanges: true,
    startUrls: ['https://www.strava.com/dashboard'],
  },
});
