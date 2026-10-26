# Devpost Submission Draft

Copy each section into the Devpost form. Deadline: Friday 23 October 2026, 12:00 PT (22:00 EAT); submit by 18:00 EAT. Entries can be edited until the deadline, not after.

## Links

- **Demo video (public on YouTube, 1:17):** https://youtu.be/TU6OOYvhF2o
- **Repository (public, MIT licence):** https://github.com/asiyetajwa/pawzoo
- **Fire TV app (APK):** https://github.com/asiyetajwa/pawzoo/releases/latest/download/pawzoo-tv.apk (release page: https://github.com/asiyetajwa/pawzoo/releases/tag/v0.3.0)
- **Thumbnail:** `docs/thumbnail.jpg` (3:2) in the repo: https://github.com/asiyetajwa/pawzoo/blob/main/docs/thumbnail.jpg

Music and sound in the film were generated with ElevenLabs (Music and Sound Effects) on Brian's ElevenLabs account; the narration is the ElevenLabs voice Jessica. Brian confirmed the account's rights cover their use in the video.

## Project name

Pawzoo

## Tagline

Ring sees your dog's day. Alexa+ acts on it. Fire TV shows it.

## Tracks and mini challenges

- Primary tracks: **Alexa+** (simulated Alexa+ path: the simulator is a real MCP client over Streamable HTTP, which the FAQ accepts) and **Ring** (replay mode, approved on the forum). A project can win at most one track prize and one mini challenge prize.
- **Fire TV: not entered** (Brian's decision). The rules require the video to show the APK on a Fire TV device or the Fire TV/Vega simulator; the film shows the browser preview. The Fire TV app is still in the repo and the release.
- Mini challenge: **AWS Builder** (Amazon Bedrock with Amazon Nova 2 Lite, Amazon DynamoDB; described under Product feedback as required). Not entered: Open Source (needs a separate open-source contribution URL).

## Built with

TypeScript, Node.js, Express, Model Context Protocol TypeScript SDK v2, MCP Apps, Ring API, React Native for TV (react-native-tvos), Expo, react-native-video, Amazon Bedrock, Amazon Nova 2 Lite, Amazon DynamoDB, ElevenLabs, three.js, Remotion, Playwright

## Description

More than half of American homes have a dog, and many of them already have Ring cameras watching the front door and the living room. Today that turns into dozens of motion alerts nobody watches. Pawzoo turns them into the dog's day, and then does something about it.

**Ring sees.** Pawzoo receives signed Ring webhooks and asks the Ring API what moved: a person, an animal or both. From that it knows when the walker arrived, when they left with the dog and when they came back, when the dog had breakfast, napped or did zoomies, and when the dog went out of the front door with no one.

**Alexa+ acts.** Pawzoo is a self-hosted MCP server (spec 2025-11-25, Streamable HTTP) with 13 tools and MCP Apps cards. Ask "How was Biscuit's day?" and hear a short answer. Pawzoo checks the walk against the camera ("35 minutes of the 30 booked; this week's only short one was two days ago, at 18"). It projects when the food runs out and offers to reorder before it does. It pays and tips the walker and books the groomer on the morning slot the family said works best. It remembers what you tell it: "she's on two and a half cups a day now" moves the food forecast. Nothing spends money or books time without a yes: every quote carries a one-time confirmation that only the person's "yes" or a tap on the card can use.

**Fire TV shows.** At 7 PM the family watches "Biscuit's Day", a reel cut from the day's camera clips. Move through the moments with the remote, or ask Alexa+ "show me when Maya got home on the TV" and it jumps there. If the dog gets out, Pawzoo announces it and the TV switches to the front door camera.

**How it is built.** The agent is deterministic code: walk verification, the food forecast, alerts and slot ranking never invent numbers. Amazon Bedrock phrases the evening digest and, in the simulator, picks tools from the live tools/list. State lives in Amazon DynamoDB. The Alexa+ add-on toolkit is not open to entrants, so the repo includes a simulated Alexa+ screen device that is a real MCP client and MCP Apps host, with a live protocol panel. Ring runs in replay mode by default (organisers confirmed this is fine for judging): recorded webhooks are signed and sent through the same verification path a live Ring account uses. The Fire TV app is React Native for TV on Fire OS.

The demo household, dog, walker, businesses and purchases are fictional, the dog is animated, and nothing is charged. Pawzoo gives no veterinary advice.

## Built during the submission window

Pawzoo is a new project, started on October 21, 2026. Every file in the repository was written during the submission window.

## Testing instructions

1. Install Node.js 22+. `npm run setup`, then `npm start`.
2. Open http://127.0.0.1:8787 and click "How Was Biscuit's Day?", then the other suggestions ("Yes" answers the latest question). Use "Under the Hood" to see MCP traffic and the demo controls (jump the clock, make the dog get out, reset). The demo opens at 7 PM with the whole day on camera.
3. Open http://127.0.0.1:8787/tv.html for the TV in a browser.
4. Fire TV: install [`pawzoo-tv.apk`](https://github.com/asiyetajwa/pawzoo/releases/latest/download/pawzoo-tv.apk) (Fire TV, Android TV emulator, or any Android phone or tablet). It plays a built-in sample day with no server. To go live, run `npm run start:tv` and type the address it prints into the app's Connect screen.
5. `npm test` runs thirteen tests, eleven of them end to end through a real MCP client.

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
- **Onboarding:** we created a Ring developer account, but we have no Ring camera, so we built from the API reference and ran in replay mode, which the organisers approved on the forum. The reference was enough to write signature verification, event history and media download, but we could not exercise them against a live account. A public sandbox with a sample device and recorded events would let entrants without hardware test the real calls.
- **Build again:** Yes. Cameras people already own are the cheapest way to sense a home.

### React Native for TV (react-native-tvos), Expo, Amazon's react-native-multi-tv-app-sample

- **Used for:** the Fire OS app: D-pad focus, media keys, video playback, live casts.
- **Worked well:** the sample's Expo config plugins (TV banner, Kotlin settings) carried straight over; `hasTVPreferredFocus` and `useTVEventHandler` covered remote control.
- **Needs work:** the Android TV emulator needs hardware virtualisation, which our cloud build machine lacks, so we checked layouts by rendering the same components with react-native-web and checked the APK with aapt. `fetch` in React Native has no default timeout: our first APK waited forever for a server it could not reach and showed an empty screen, so every request now has a timeout and the app ships a sample day. Fire TV reports 960x540 dp, so sizes must be planned in dp from the start. npm rejects some peer ranges against the `react-native-tvos` prerelease version (we set `legacy-peer-deps`).
- **Onboarding:** about half a day from the sample's configuration to a signed APK, most of it Gradle and Maven downloads.
- **Build again:** Yes. One React Native codebase covered the Fire TV remote, phones and tablets.

### Amazon Bedrock

- **Used for:** the spoken evening digest and the simulator's tool selection from the live MCP tools/list, both through the Converse API, with Amazon Nova 2 Lite (`us.amazon.nova-2-lite-v1:0`, a US cross-region inference profile).
- **Worked well:** one API (Converse, with tool use) for any model, so changing models is one environment variable.
- **Needs work:** models differ in what they accept: some reject `temperature` (we retry without it) and we strip the `$schema` keyword from MCP tool schemas before passing them as Converse tools. A per-model list of supported inference parameters and JSON Schema keywords in the Converse docs would save trial and error.
- **Onboarding:** model access was a short request in the console. The first model we picked was not available to our account, so we moved to Amazon Nova 2 Lite through its US cross-region inference profile; `npm run check:aws` then answered in about 1.4 seconds. The difference between a model ID and an inference profile ID (the `us.` prefix) is easy to miss.
- **Build again:** Yes.

### Amazon DynamoDB

- **Used for:** the household's state (one item per household).
- **Worked well:** created in the console in a minute (on-demand, partition key `householdId`, String); one item per household fits the app, and `npm run check:aws` confirms the table and its key before the demo.
- **Needs work:** nothing in DynamoDB itself. Our one snag was our own: a stale `.env` pointing at an older table name, which is why Pawzoo now prints the table it uses and falls back to a local file, saying so, if the table cannot be reached.
- **Build again:** Yes.

## Feature requests (optional)

| Request | Why it matters | Priority |
|---|---|---|
| Put the motion class (human, animal, vehicle) on Ring `motion_detected` webhooks | Saves a history call per event and a race with history lag | Important |
| Open the Alexa+ MCP Toolkit or a public Alexa+ simulator to hackathon entrants | Lets entrants show real Alexa+ rendering of MCP Apps cards | Important |
| A light MCP Apps view runtime | 600 KB per card is heavy for screen devices | Nice-to-have |

## Friction log (optional, up to 10% bonus)

Paste from [FRICTION_LOG.md](FRICTION_LOG.md).
