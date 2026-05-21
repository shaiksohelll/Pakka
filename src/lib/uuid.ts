/**
 * Generate a UUID v4.
 *
 * Uses `crypto.randomUUID()` in secure contexts (HTTPS or localhost).
 * Falls back to `crypto.getRandomValues()` for insecure dev contexts
 * (e.g. accessing dev server via LAN IP `192.168.x.x` over HTTP).
 *
 * Both paths produce RFC4122 v4 UUIDs with cryptographic randomness — safe
 * for idempotency keys, request IDs, etc.
 */
export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last-ditch fallback — should never hit in any modern browser.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
