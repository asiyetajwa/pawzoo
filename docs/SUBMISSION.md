# Devpost Submission Draft

Fill in the parts marked **TODO** before submitting. Submit by Friday 18:00 EAT (08:00 PT), four hours before the deadline.

## Project name

Pawzoo

## Tagline

Ring sees your dog's day. Alexa+ acts on it. Fire TV shows it.

## Tracks and mini challenges

- Primary tracks: **Alexa+**, **Ring**, **Fire TV** (Emerson Sklar confirmed on the forum that one project may enter several tracks and win at most one).
- Mini challenges: **AWS Builder** (Amazon Bedrock, Amazon DynamoDB, Kiro if used) and **Open Source** (**TODO**: contribution URL).

## Description

More than half of American homes have a dog, and many of them already have Ring cameras watching the front door and the living room. Today that turns into dozens of motion alerts nobody watches. Pawzoo turns them into the dog's day, and then does something about it.

**Ring sees.** Pawzoo receives signed Ring webhooks and asks the Ring API what moved: a person, an animal or both. From that it knows when the walker arrived, when they left with the dog and when they came back, when the dog had breakfast, napped or did zoomies, and when the dog went out of the front door with no one.

**Alexa+ acts.** Pawzoo is a self-hosted MCP server (spec 2025-11-25, Streamable HTTP) with 13 tools and MCP Apps cards. Ask "How was Biscuit's day?" and hear a short answer. Pawzoo checks the walk against the camera ("35 minutes of the 30 booked; this week's only short one was Tuesday, at 18"). It projects when the food runs out and offers to reorder before it does. It pays and tips the walker and books the groomer on the morning slot the family said works best. It remembers what you tell it: "she's on two and a half cups a day now" moves the food forecast. Nothing spends money or books time without a yes: every quote carries a one-time confirmation that only the person's "yes" or a tap on the card can use.

**Fire TV shows.** At 7 PM the family watches "Biscuit's Day", a reel cut from the day's camera clips. Move through the moments with the remote, or ask Alexa+ "show me when Maya got home on the TV" and it jumps there. If the dog gets out, Pawzoo announces it and the TV switches to the front door camera.

**How it is built.** The agent is deterministic code: walk verification, the food forecast, alerts and slot ranking never invent numbers. Amazon Bedrock phrases the evening digest and, in the simulator, picks tools from the live tools/list. State lives in Amazon DynamoDB. The Alexa+ add-on toolkit is not open to entrants, so the repo includes a simulated Alexa+ screen device that is a real MCP client and MCP Apps host, with a live protocol panel. Ring runs in replay mode by default (organisers confirmed this is fine for judging): recorded webhooks are signed and sent through the same verification path a live Ring account uses. The Fire TV app is React Native for TV on Fire OS.

The demo household, dog, walker, businesses and purchases are fictional, the dog is animated, and nothing is charged. Pawzoo gives no veterinary advice.

## Built during the submission window

Pawzoo is a new project, started on October 21, 2026. Every file in the repository was written during the submission window.

## Testing instructions

1. Install Node.js 22+. `npm run setup`, then `npm start`.
2. Open http://127.0.0.1:8787 and click "How Was Biscuit's Day?". Use "Under the Hood" to see MCP traffic and the demo controls (jump the clock, make the dog get out, reset).
3. Open http://127.0.0.1:8787/tv.html for the TV in a browser, or install the APK from the repo's Releases on a Fire TV or the Android TV emulator.
4. `npm test` runs twelve tests, ten of them end to end through a real MCP client.

No accounts or credentials are needed.

## Product feedback (required: every tool, API and SDK)

### Model Context Protocol TypeScript SDK v2 and MCP Apps (`@modelcontextprotocol/server`, `client`, `node`, `ext-apps`)

- **Used for:** the Pawzoo MCP server, the browser MCP client in the simulator, and the MCP Apps card plus its host bridge.
- **Worked well:** `createMcpHandler` serves 2025-era clients (initialize, tools/list, tools/call) and 2026-07-28 clients from one factory. `registerAppTool` / `registerAppResource` made the card a few lines. `AppBridge` made hosting the card in our own simulator straightforward.
- **Needs work:** it was not obvious which package line meets "spec 2025-11-25": v1 is one package, v2 is split and documents itself as 2026-07-28. A stateless server answers the client's standalone GET with 405, which shows as a console error in every browser host. The MCP Apps view bundle is about 600 KB for one card.
- **Onboarding:** about an hour to a working server, mostly reading type definitions to confirm protocol versions.
- **Build again:** Yes. One server definition drove the voice answers, the cards and the tests.

### Ring (Amazon Vision API)

- **Used for:** webhook verification (HMAC-SHA256 `X-Signature`), device list, event history (human, animal, vehicle classes), clip and snapshot download.
- **Worked well:** signed webhooks, clear media download endpoints, the elder care and pet use cases in the developer portal, and the replay-mode guidance on the hackathon forum.
- **Needs work:** the motion class is not on the `motion_detected` webhook, so every event needs a second call to event history. The API reference is one very long page. There is no official SDK.
- **Onboarding:** **TODO** (Brian: your experience creating the Ring developer account and Playground token).
- **Build again:** Yes. Cameras people already own are the cheapest way to sense a home.

### React Native for TV (react-native-tvos), Expo, Amazon's react-native-multi-tv-app-sample

- **Used for:** the Fire OS app: D-pad focus, media keys, video playback, live casts.
- **Worked well:** the sample's Expo config plugins (TV banner, Kotlin settings) carried straight over; `hasTVPreferredFocus` and `useTVEventHandler` covered remote control.
- **Needs work:** **TODO** after testing on the emulator.
- **Onboarding:** **TODO**.
- **Build again:** **TODO**.

### Amazon Bedrock

- **Used for:** the spoken evening digest and the simulator's tool selection from the live MCP tools/list, both through the Converse API, with `openai.gpt-5.6-luna`.
- **Worked well:** one API (Converse, with tool use) for any model, so changing models is one environment variable.
- **Needs work:** some models reject `temperature` with a ValidationException; we retry without it. A per-model list of supported inference parameters in the Converse docs would save a round trip. **TODO** (Brian): model access request experience and the latency you saw in `npm run check:aws`.

### Amazon DynamoDB

- **Used for:** the household's state (one item per household).
- **TODO** (Brian): table setup experience.

### Kiro

- **TODO**: only include if Kiro was used during the build, and say for what.

## Feature requests (optional)

| Request | Why it matters | Priority |
|---|---|---|
| Put the motion class (human, animal, vehicle) on Ring `motion_detected` webhooks | Saves a history call per event and a race with history lag | Important |
| Open the Alexa+ MCP Toolkit or a public Alexa+ simulator to hackathon entrants | Lets entrants show real Alexa+ rendering of MCP Apps cards | Important |
| A light MCP Apps view runtime | 600 KB per card is heavy for screen devices | Nice-to-have |

## Friction log (optional, up to 10% bonus)

Paste from [FRICTION_LOG.md](FRICTION_LOG.md).
