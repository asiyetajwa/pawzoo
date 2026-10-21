# Friction log

Kept as we built, in the format the hackathon asks for. Severity: Blocker, High, Medium, Low.

## 1. Which MCP TypeScript SDK meets "spec 2025-11-25"?

- **Task:** Pick the SDK for a self-hosted MCP server on spec 2025-11-25 over Streamable HTTP.
- **Steps:** `npm view @modelcontextprotocol/sdk` (1.32.1, latest). Found the MCP Apps package `@modelcontextprotocol/ext-apps@2.0.3` needs the v2 split packages (`@modelcontextprotocol/server`, `client`, `node`). The v2 README says it implements the 2026-07-28 spec.
- **Expected:** One package, one obvious answer for "2025-11-25 or later".
- **Actual:** Two package lines with different names. v2 serves 2026-07-28 and falls back to 2025-era clients through a stateless legacy path; the client defaults to the 2025 `initialize` handshake. We had to read `.d.mts` files to confirm `LATEST_PROTOCOL_VERSION = '2025-11-25'` for the legacy leg.
- **Severity:** Medium.
- **Workaround:** v2 (`server@2.3.1`, `client@2.3.1`, `node@2.1.1`) with `createMcpHandler`, which serves both eras from one factory. A test asserts the negotiated version is 2025-11-25.
- **Suggestion:** In the hackathon resources, name the exact packages and versions that satisfy the rule, and say that v2's legacy fallback counts.

## 2. MCP Apps view bundle size

- **Task:** Bundle an MCP Apps view (one card) into a single HTML resource.
- **Steps:** esbuild bundle of `App` from `@modelcontextprotocol/ext-apps`.
- **Expected:** A small view runtime.
- **Actual:** 597 KB of HTML for one card, mostly schema validation code.
- **Severity:** Low.
- **Workaround:** Accepted for the demo.
- **Suggestion:** Ship a light view entry point without full schema validation.

## 3. Ring motion classification is in two places

- **Task:** Tell "the dog went out alone" from "the walker took the dog".
- **Steps:** Read the Ring API reference. The webhook sample shows `attributes.sub_type: "motion"`; human, animal and vehicle classes appear as `motion.human`, `motion.animal`, `motion.vehicle` in the event history API's `event_types` filter.
- **Expected:** The class on the webhook itself.
- **Actual:** We query event history after each webhook to learn what moved. That is an extra call per event and a race if history lags the webhook.
- **Severity:** Medium.
- **Workaround:** History lookup within 60 seconds of the webhook timestamp.
- **Suggestion:** Put the motion class (and confidence) on `motion_detected` webhooks.

## 4. The Ring API reference is one very long page

- **Task:** Find the clip download body and the signature format.
- **Steps:** The reference is a single page of about 375,000 characters. Webhook, media and history sections are far apart.
- **Expected:** One page per resource, with a request and response example each.
- **Actual:** Hard to search and hard for AI coding tools to load in one go.
- **Severity:** Low.
- **Workaround:** Read it in slices.
- **Suggestion:** Split by resource, and publish an OpenAPI file.

## 5. No official Ring SDK

- **Task:** Call the Amazon Vision API from Node.
- **Actual:** The docs say there is no official partner SDK; examples use raw `fetch` with required `User-Agent` and `Hardware_Id` headers (a missing one returns 406).
- **Severity:** Low.
- **Workaround:** A small typed client in `server/src/ring.ts`.
- **Suggestion:** A thin official TypeScript client with webhook verification built in.

## 6. A stateless MCP server makes every browser host log an error

- **Task:** Run the Pawzoo MCP server stateless (state lives in our store) and connect from a browser MCP client.
- **Steps:** `createMcpHandler(factory)` with the default stateless legacy leg; `StreamableHTTPClientTransport` in the browser.
- **Expected:** A quiet connection.
- **Actual:** After `initialize`, the client opens the optional standalone GET stream; the stateless server answers `405 Method Not Allowed`, as the spec allows. The client handles it, but the browser console shows a failed request on every page load.
- **Severity:** Low.
- **Workaround:** None needed functionally; we note it so judges don't read it as a bug.
- **Suggestion:** Let the client skip the standalone GET when the server advertises no server-initiated messages, or have stateless servers say so in `initialize`.
