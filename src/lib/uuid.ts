/**
 * Generate a UUID v4.
 *
 * Uses `crypto.randomUUID()` in secure contexts (HTTPS or localhost).
 * Falls back to `crypto.getRandomValues()` for insecure dev contexts
 * (e.g. accessing dev server via LAN IP `192.168.x.x` over HTTP).
 *
 * If neither secure crypto API is available, throws. We do not fall back
 * to `Math.random()` because UUIDs are used as wallet idempotency keys
 * where collision resistance is a correctness requirement, not a nicety.
 *
 * Both supported paths produce RFC4122 v4 UUIDs with cryptographic
 * randomness — safe for idempotency keys, request IDs, etc.
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
  throw new Error("Secure crypto API unavailable; cannot generate UUID safely.");
}
