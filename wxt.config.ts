import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";


// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
   manifest: {
    name: 'Google Meet Recorder',
    description: 'Record audio from a specific tab and stream it to a file',
    version: '1.0',
    permissions: [
      'activeTab',
      'tabCapture',
      'tabs',
      'storage',
      'cookies',
      'offscreen'
    ],
    host_permissions: [
      'http://localhost/*'
    ],
    web_accessible_resources: [
      {
        resources: ['entrypoints/offscreen/*'],
        matches: ['<all_urls>']
      }
    ]
  },


  vite: () => ({
    plugins: [tailwindcss()],
  }),

});
