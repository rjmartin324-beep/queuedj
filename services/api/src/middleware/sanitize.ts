// ─────────────────────────────────────────────────────────────────────────────
// Sanitize Middleware
//
// sanitizeText() is a pure function — call it wherever user-supplied strings
// enter the system (room names, display names, messages, etc.).
//
// What it does:
//   1. Rejects non-string values (returns "")
//   2. Strips all HTML tags  (<script>alert(1)</script> → "alert(1)")
//   3. Strips angle-bracket remnants and null bytes
//   4. Trims leading/trailing whitespace
//   5. Collapses interior whitespace runs to single spaces
//   6. Enforces a maximum length (default: 60 chars to match room name schema)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strip HTML, trim, and enforce a maximum length on any user-supplied string.
 *
 * @param value   The raw value from the request body or query string.
 * @param maxLen  Maximum character length after sanitizing (default 60).
 * @returns       A safe, trimmed string — or "" if value is not a string.
 */
export function sanitizeText(value: unknown, maxLen = 60): string {
  if (typeof value !== "string") return "";

  return value
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove null bytes (can cause unexpected behavior in some DBs)
    .replace(/\0/g, "")
    // Remove lingering < and > that survived tag stripping
    .replace(/[<>]/g, "")
    // Collapse interior whitespace runs to a single space
    .replace(/\s+/g, " ")
    // Trim edges
    .trim()
    // Enforce length
    .slice(0, maxLen);
}
