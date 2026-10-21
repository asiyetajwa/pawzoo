# Demo Video Script (target 2:45, hard limit under 3:00)

Format: public YouTube, English, narration by ElevenLabs, screen recordings plus the Biscuit animation. No third-party music, logos or footage. Lead with the best moment.

Recording setup:
- Server: `npm start`.
- Simulator: http://127.0.0.1:8787 at 1440x900, "Under the Hood" closed except in scene 7.
- TV: the Pawzoo app on the Android TV emulator (Fire OS build), or http://127.0.0.1:8787/tv.html as backup.
- Reset before each take with the Reset button.

| # | Time | Picture | Narration (ElevenLabs) |
|---|---|---|---|
| 1 | 0:00-0:15 | Animation: the family on the couch at 7 PM. Cut to the TV app playing "Biscuit's Day": the zoomies, the walk, Maya coming home. | "It's 7 PM. Maya asks the TV what Biscuit did all day, and the house shows her." |
| 2 | 0:15-0:32 | Title card: Pawzoo. Then four Ring camera tiles of Biscuit's day, motion alerts piling up. | "More than half of American homes have a dog. Ring cameras already see the dog's whole day, as dozens of motion alerts nobody watches. Pawzoo turns them into a day, and acts on it." |
| 3 | 0:32-1:02 | Animation: the walker at the front door, leaving with Biscuit, coming back. Simulator at 9 AM: "How long was the walk?" Walk card. "Pay Dana with a three dollar tip." Confirm card. "Yes." | "The front door camera saw Dana leave with Biscuit at 8:06 and bring her back at 8:41. Thirty-five minutes of the thirty booked. Pawzoo also remembers the week: Tuesday's walk lasted eighteen. Paying takes a yes, never a guess." |
| 4 | 1:02-1:30 | Simulator: "Do we need dog food?" Food card. "She's on two and a half cups a day now." The forecast moves. "Reorder her food." Confirm card, tap Confirm. | "Pawzoo knows how fast the bag is going, and when you tell it something, it remembers. The reorder arrives before she runs out. Nothing is bought until you say so." |
| 5 | 1:30-1:55 | Animation: 2:20 PM, Biscuit slips out of the front door alone. Simulator: Pawzoo speaks up on its own. The TV switches to the front door camera. "She's back inside." | "And when something's wrong, Pawzoo doesn't wait to be asked. A dog outside with no person gets an announcement and the front door camera on every screen." |
| 6 | 1:55-2:20 | Simulator at 7 PM: "How was Biscuit's day?" Day card. "Show me when Maya got home on the TV." The TV jumps to the moment. | "At the end of the day, one question gets one answer. Ask for a moment, and it plays on the big screen." |
| 7 | 2:20-2:40 | "Under the Hood" open: initialize on 2025-11-25, tools/list with 13 tools, tools/call, the MCP Apps card, Ring webhook events. Then the Fire TV app moving through moments with the remote. | "Under the hood: a self-hosted MCP server on spec 2025-11-25 over Streamable HTTP, with MCP Apps cards. Signed Ring webhooks in. A Fire OS app on the TV. Amazon Bedrock writes the digest. Amazon DynamoDB keeps the memory." |
| 8 | 2:40-2:50 | End card: "Ring sees. Alexa+ acts. Fire TV shows." Small print: "Simulated Alexa+ add-on. Demo household and purchases are fictional." | "Ring sees. Alexa+ acts. Fire TV shows. Pawzoo." |

Notes:
- Scenes 1, 3 and 5 use the animated clips. They are the same files the replay feeds through the Ring webhook path, so what the TV shows is what the system ingested.
- Keep narration to about 380 words for 2:45.
- On screen, the simulator says "Simulated Alexa+ add-on". Emerson Sklar confirmed on the Devpost forum that this wording is fine.
- Source for the dog statistic: American Pet Products Association, 2026 State of the Industry report (53% of US households owned a dog in 2025), as reported at https://www.petfoodindustry.com/pet-ownership-statistics/article/15747936 . Re-check before recording.
- Scene 7 names Amazon Bedrock and DynamoDB. Before recording, run `npm run check:aws` (both lines must say OK). During the take, "Under the Hood" must show "Assistant: Amazon Bedrock (...)", "Digest: Amazon Bedrock (...)" and "State: Amazon DynamoDB". If any says otherwise, cut that sentence.
