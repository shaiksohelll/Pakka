import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000"
const vercelBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	expect: { timeout: 10_000 },
	// Money path is stateful — keep it serial so balances/ledger stay deterministic.
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	forbidOnly: !!process.env.CI,
	reporter: process.env.CI
		? [["github"], ["html", { open: "never" }]]
		: "list",
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
		...(vercelBypass
			? {
					extraHTTPHeaders: {
						"x-vercel-protection-bypass": vercelBypass,
						"x-vercel-set-bypass-cookie": "true",
					},
				}
			: {}),
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})