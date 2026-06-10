import { defineConfig, devices } from '@playwright/test'

const port = 3001
const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'android-chromium',
      use: {
        ...devices['Pixel 7']
      }
    },
    {
      name: 'iphone-webkit',
      use: {
        ...devices['iPhone 13']
      }
    }
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
})
