import { test as base, expect } from "@playwright/test"

// Extends the base test so every test collects console + page errors.
// Assert `expect(consoleErrors).toEqual([])` at the end of each test.
export const test = base.extend<{ consoleErrors: string[] }>({
	consoleErrors: async ({ page }, use) => {
		const errors: string[] = []
		page.on("console", (msg) => {
			if (msg.type() === "error") {
				console.error("[Browser Error]", msg.text())
				errors.push(msg.text())
			}
		})
		page.on("pageerror", (err) => errors.push(err.message))
		// eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture 'use', not a React Hook
		await use(errors)
	},
})

export { expect }