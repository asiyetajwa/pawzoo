# Pawzoo, Nebius edition

**Your home cameras already see your dog's day. Pawzoo turns it into answers, reminders and an evening update, with NVIDIA Nemotron on Nebius Token Factory doing the language work.**

Pawzoo is a pet-care agent. It is an MCP server any voice assistant or AI host can use, plus a voice assistant simulator and a TV view:
- **It knows the day** from camera events. That covers the walk (checked against what the front door camera saw), meals, naps, zoomies, and the dog leaving the house alone.
- **It acts.** It forecasts when the food runs out and offers to reorder, pays and tips the walker, and books grooming or a vet check-up. Anything that spends money waits for a yes.
- **It speaks first.** At 19:00 every day it writes the evening update and pushes it to the TV and the assistant, without being asked.

> Pawzoo is a hackathon project. The household, dog, walker, businesses and products in the demo are fictional, every purchase is simulated and nothing is charged. Pawzoo gives no veterinary advice.

## What is new in this edition

Pawzoo was first built October 21 to 23, 2026, for an Amazon hackathon (https://devpost.com/software/pawzoo), on Amazon Bedrock. That build is on `main` and is unchanged. This branch, `nebius`, is the edition for the Nebius x NVIDIA Global AI Hackathon:

1. **The model layer runs on NVIDIA Nemotron via Nebius Token Factory.**
   - Nemotron 3 Super picks Pawzoo's tools from the live MCP `tools/list`, through OpenAI-style tool calling. It sees each step's tool results before choosing the next, up to two steps a question.
   - Nemotron 3 Nano phrases the day's facts into a short spoken update.

   One module changed (`server/src/nemotron.ts` replaced `bedrock.ts`). Everything that decides anything (the day, the food forecast, quotes, bookings, payments, alerts) is plain code that never calls a model, so the swap touched nothing else.
2. **A spend guard on every call:**
   - it reads Token Factory's published prices;
   - it reserves each call's worst case before sending;
   - it records the real cost from the returned usage in a ledger;
   - it refuses anything past `PAWZOO_BUDGET_USD`;
   - it halts on any billing error.
3. **A cost and latency panel** ("Under the Hood", then "Nemotron on Nebius"). It shows every call with its scope, model, tokens, time and cost, and totals per conversation turn and per digest.
4. **The proactive evening digest:**
   - At 19:00 on Pawzoo's clock it writes the day's update and pushes it to the TV and the assistant.
   - The same work runs as a standalone job (`server/src/jobs/evening-digest.ts`). The job reads the day from a running Pawzoo, has Nemotron write the update, and delivers it to `POST /api/digest/deliver` with a job token.
   - The repo's `Dockerfile` builds one image for the server and the job. The job is the unit to schedule as a Nebius Serverless Job.
5. **The screens use generic names** (voice assistant, home cameras, TV), so the edition stands on its own.

## Measured on Nebius (October 26, 2026)

| Call | Model | Typical tokens | Typical time | Typical cost |
|---|---|---|---|---|
| One step of a question (pick tools) | Nemotron 3 Super | about 1,900 | about 1 s | about $0.0006 |
| The evening digest (phrase) | Nemotron 3 Nano | about 500 | about 1 s | about $0.00005 |

A question takes one or two steps:
1. Nemotron picks tools.
2. It sees what the tools returned and either takes one more step (for example, playing on the TV the moment it found) or stops.

So a question costs about **$0.0012**. A household's month of 10 questions a day plus the evening digest comes to about **$0.36**.

The `nebius` branch does not deploy the MCP server on Nebius compute or run the digest job as a Serverless Job. Both would bill compute beyond the Token Factory credit this project had. The image and the job are ready for it, and the steps are below.

## Run it

You need Node.js 22 or later.

```bash
git clone -b nebius https://github.com/asiyetajwa/pawzoo
cd pawzoo
npm run setup      # installs and builds the server and the web apps
npm start          # http://127.0.0.1:8787 (simulator), /tv.html (TV view), /mcp (MCP endpoint)
npm test
```

Copy `.env.example` to `.env` and add a Nebius Token Factory key with a spending cap. Without one, Pawzoo answers with rules and templates and says so in "Under the Hood".

**To see the evening digest**, either:
- press **2p** on the clock, then **7p**; or
- press **Run Evening Digest** in "Under the Hood".

## The evening digest job

```bash
# Against a running Pawzoo that has PAWZOO_JOB_TOKEN set:
PAWZOO_URL=http://127.0.0.1:8787 PAWZOO_JOB_TOKEN=... NEBIUS_API_KEY=... PAWZOO_BUDGET_USD=0.05 \
  node server/dist/jobs/evening-digest.js
```

**To run it on Nebius:**
1. Build the image (`docker build -t pawzoo .`) and push it to a registry Nebius can pull from.
2. Create a Serverless Job with the command `node server/dist/jobs/evening-digest.js`.
3. Give it the environment above, and schedule it daily for 19:00 in the family's time zone.

**To serve the MCP server** from the same image, run it with `HOST=0.0.0.0` behind HTTPS and set `PAWZOO_ALLOWED_ORIGINS`.

## The MCP server

Pawzoo is an MCP server (Streamable HTTP, spec 2025-11-25). Each tool returns a line to speak and an MCP Apps card.

| Tool | What it does |
|---|---|
| `get_pet_day`, `find_moment`, `play_on_tv`, `get_alerts`, `resolve_alert` | The dog's day from the cameras |
| `check_food`, `remember` | The food forecast, and facts the family tells Pawzoo |
| `quote_food_order`, `get_walk_report`, `quote_walk_payment` | Quotes that wait for a yes |
| `find_care_slots`, `quote_booking`, `confirm_action` | Bookings and the yes that confirms them |

## Layout

- `server/src/nemotron.ts`: Nemotron calls (routing, spend guard, the panel's call log).
- `server/src/nebius/`: the Token Factory client, the spend guard and telemetry.
- `server/src/assistant.ts`: tool choice, with Nemotron or rules.
- `server/src/digest.ts`: the digest, with Nemotron or a template.
- `server/src/schedule.ts`: the 19:00 digest.
- `server/src/jobs/evening-digest.ts`: the same digest as a standalone job.
- `server/src/agent.ts`: the day, food, quotes and alerts. Deterministic.
- `server/src/mcp.ts`: the MCP tools.
- `web/`: the voice assistant simulator and the TV view.
- `Dockerfile`: one image for the server and the job.

## License

MIT
