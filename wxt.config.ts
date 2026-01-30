import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: ['storage'],
  },
  runner: {
    binaries: {
      firefox: 'C:\\Program Files\\Firefox Developer Edition\\firefox.exe',
    },
    firefoxProfile: './.firefox-profile', // Persistent profile directory
  },
});
