import { Page, expect } from "@playwright/test"

export const DEMO = {
	client: "+919876500001",
	worker: "+919876500011",
	admin: "+919876500099",
} as const

export const DEMO_OTP = "123456"

// Phone-OTP login (DEMO_MODE bypass code). TODO: align test ids/urls.
export async function login(page: Page, phone: string) {
	await page.goto("/login")

	await page.getByTestId("phone-input").fill(phone.replace(/^\+91/, ""))
	await page.getByTestId("send-otp").click()

	await expect(page).toHaveURL(/\/login\/verify/)

	await page.getByTestId("otp-input").pressSequentially(DEMO_OTP, { delay: 50 })

	await expect(page).toHaveURL(/\/(client|worker|admin|onboarding)/)
}

export async function logout(page: Page) {
	await page.locator("a[href$='/account']").click()
	await page.getByTestId("sign-out").click()
	await page.getByTestId("sign-out-confirm").click()
	await expect(page).toHaveURL(/\/login/)
}

// Reads a money value rendered with data-testid="wallet-available" / "wallet-locked".
export async function balance(page: Page, which: "available" | "locked") {
	const raw = await page.getByTestId(`wallet-${which}`).innerText()
	return Number(raw.replace(/[^0-9.]/g, ""))
}

// Waits for a specific RPC to return 2xx (proves the money write happened).
export async function expectRpcOk(page: Page, urlPart: string, act: () => Promise<void>) {
	const [res] = await Promise.all([
		page.waitForResponse((r) => r.url().includes(urlPart) && r.request().method() === "POST"),
		act(),
	])
	expect(res.status(), `${urlPart} should return 2xx`).toBeLessThan(400)
	return res
}

/**
 * Drive the 6-step PostJobForm wizard as the currently-logged-in client.
 * Navigates to /client/jobs/new, fills all required fields, submits.
 * Returns the newly created job's ID extracted from the redirect URL.
 */
export async function postJob(
	page: Page,
	opts: { title?: string; budget?: string; milestoneTitle?: string } = {},
): Promise<string> {
	const title = opts.title ?? "E2E test job"
	const budget = opts.budget ?? "1000"
	const milestoneTitle = opts.milestoneTitle ?? "Complete work"

	await page.getByTestId("post-job").click()
	await expect(page).toHaveURL(/\/client\/jobs\/new/)

	// Step 1: Basics
	await page.getByTestId("job-title").fill(title)
	await page.getByRole("combobox").click()
	await page.getByRole("option").first().click()
	await page.locator("#description").fill("E2E smoke test job for escrow flow testing")
	await page.getByRole("button", { name: "Next", exact: true }).click()

	// Step 2: Location
	await page.locator("#location_text").fill("Banjara Hills, Hyderabad")
	await page.getByRole("button", { name: "Next", exact: true }).click()

	// Step 3: Budget
	await page.locator("#total_budget").fill(budget)
	await page.getByRole("button", { name: "Next", exact: true }).click()

	// Step 4: Milestones
	await page.locator("#ms-title-0").fill(milestoneTitle)
	await page.getByTestId("milestone-amount-0").fill(budget)
	await page.getByRole("button", { name: "Next", exact: true }).click()

	// Step 5: Materials — skip
	await page.getByRole("button", { name: "Next", exact: true }).click()

	// Step 6: Review → Submit
	await page.getByTestId("job-submit").click()
	await expect(page).toHaveURL(/\/client\/jobs\/[0-9a-f-]+$/, { timeout: 15_000 })

	return page.url().split("/").pop()!
}

/**
 * Worker applies to a job (navigates to /worker/jobs/:id, opens modal, fills bid).
 */
export async function applyToJob(page: Page, jobId: string, bid: string = "1000") {
	await page.goto(`/worker/jobs/${jobId}`)
	await page.getByTestId("apply-job").click()
	await page.locator("#bid_amount").fill(bid)
	await page.locator("#eta_days").fill("7")
	await page.getByRole("button", { name: /submit application/i }).click()
	await expect(page.getByRole("button", { name: /submit application/i })).toBeHidden({
		timeout: 15_000,
	})
}

/**
 * Client accepts first applicant on a job (navigates to /client/jobs/:id).
 * After accept, the page redirects to /milestones.
 */
export async function acceptApplicant(page: Page, jobId: string) {
	await page.goto(`/client/jobs/${jobId}`)
	await page.getByTestId("accept-applicant").click()
	await expect(page).toHaveURL(/\/client\/jobs\/[0-9a-f-]+\/milestones/, { timeout: 15_000 })
}