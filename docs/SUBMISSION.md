# Devpost Submission Draft (Nebius x NVIDIA Global AI Hackathon)

Copy each section into the Devpost form.
- **Track:** Best Apps and Agents.
- **Deadline:** October 30, 2026, 17:00 UTC (10:00 PT). Confirm on https://nebiusglobalaihackathon.devpost.com/.

## Links

- **Demo video (YouTube):** to be added. It must be **Public**, under 3 minutes, with no third-party trademarks or copyrighted music.
- **Repository (public, MIT license):** https://github.com/asiyetajwa/pawzoo/tree/nebius. This edition is on the `nebius` branch; `main` is the earlier build, unchanged.
- **Thumbnail:** `docs/thumbnail.jpg` (3:2) and `docs/thumbnail-youtube.jpg` (16:9).

Every model call in the film is live on Nebius Token Factory, and the job's output is a real run.

The narration is the ElevenLabs voice Jessica. The music and sound effects were made with ElevenLabs on Brian's account.

## Project name

Pawzoo

## Tagline

A pet-care agent that knows your dog's day from your home cameras and speaks up first, with NVIDIA Nemotron on Nebius Token Factory doing the language work for about a tenth of a cent a question.

## Built with

TypeScript, Node.js, Express, Model Context Protocol, MCP Apps, NVIDIA Nemotron 3 Super, NVIDIA Nemotron 3 Nano, Nebius Token Factory, Docker, Remotion, Playwright, ElevenLabs

## Description

### What changed for this hackathon (significant update)

Pawzoo was first built October 21 to 23, 2026, for an Amazon hackathon, on Amazon Bedrock (https://devpost.com/software/pawzoo). That build is on `main` and is unchanged.

The `nebius` branch was built during this hackathon:
1. **The model layer now runs on NVIDIA Nemotron via Nebius Token Factory.**
   - Nemotron 3 Super picks tools through OpenAI-style tool calling over the live MCP tool list.
   - Nemotron 3 Nano writes the spoken updates.
2. **Questions are now agentic, in up to two steps.** Nemotron sees what its first tools returned before choosing the next one. For example, it finds the walker on camera, then plays that clip on the TV.
3. **A spend guard sits in front of every call,** with a hard cap, and **a cost and latency panel** shows every call's tokens, time and cost.
4. **The proactive evening digest is new.** At 19:00 Pawzoo writes the day's update without being asked and puts it on the TV and the assistant. The same work runs as a standalone job in a container image, ready to schedule as a Nebius Serverless Job.
5. **The screens use generic names** (voice assistant, home cameras, TV).

### Inspiration

Most pet cameras record everything and tell you nothing. We wanted the opposite: an agent that already knows how the dog's day went, answers in a sentence, handles the chores around her (food, the walker, grooming), and tells you in the evening without being asked. It also had to be cheap enough to run for one household every day.

### What it does

Pawzoo is an MCP server any voice assistant or AI host can use. It comes with a voice assistant simulator and a TV view.

- **"How was Biscuit's day?"** It answers from what the cameras saw: the walk (checked against the front door camera), meals, naps and zoomies.
- **"Do we need dog food?"** About 15 cups left, so she runs out Saturday, and it offers to reorder.
- **"Show me when the walker came on the TV."** It finds the moments, then plays the clip on the TV.
- **It pays and tips the walker and books grooming.** Anything that spends money waits for a yes.
- **At 7 PM, unasked,** it writes the evening update and puts it on the TV and the speaker.

### How we built it

- **Deterministic core, model at the edges.** The day, the food forecast, quotes, bookings and alerts are plain TypeScript. Nemotron does only two jobs:
  - choosing tools (Nemotron 3 Super);
  - turning facts into a few spoken sentences (Nemotron 3 Nano).

  Swapping the model provider changed one module.
- **Two-step tool use.** The simulator, a real MCP client, runs the tools Nemotron picks. It then sends the results back so Nemotron can decide the next step, at most two steps a question.
- **The spend guard:**
  - it reads Token Factory's published prices;
  - it reserves each call's worst case before sending;
  - it records the real cost from the returned usage;
  - it refuses anything past the cap;
  - it halts on any billing error.
- **The cost and latency panel** lists every call (scope, model, tokens, time, cost), with totals per conversation and per digest.
- **The evening digest** fires when Pawzoo's clock crosses 19:00. The standalone job reads the day from a running Pawzoo, has Nemotron write the update, and delivers it with a job token. One Dockerfile builds the server and the job.

### Measured on Nebius Token Factory

| | Model | Tokens | Time | Cost |
|---|---|---|---|---|
| One step of a question | Nemotron 3 Super | about 1,900 | about 1 s | about $0.0006 |
| The evening digest | Nemotron 3 Nano | about 500 | about 1 s | about $0.00005 |

A question takes one or two steps, so about **$0.0012**. A household asking 10 questions a day, plus the daily digest, costs about **$0.36 a month**.

### Challenges we ran into

- **Nemotron 3 Super calls one tool per turn.** It would not name a moment to play before it had seen what `find_moment` returned, which is reasonable. Instead of telling it to guess, we made questions agentic: it sees each step's results and chooses the next.
- **Nano's wording.** Nemotron 3 Nano once called the dog "he", and once put line breaks in its update. The prompt now states her pronouns, and the code normalises spacing.
- **Not claiming what we did not run.** Hosting the MCP server on Nebius compute and running the digest as a Serverless Job would bill beyond the Token Factory credit this project had. The image and the job are ready, and the README shows the steps, but we do not claim either as running.

### Accomplishments that we're proud of

- **A provider swap that touched one module,** because the model only chooses and phrases.
- **An agent that speaks first,** on a schedule, and costs about a third of a dollar per household per month.
- **A meter on every call,** visible in the app.

### What we learned

Small models are enough when the model's job is narrow. Two short steps with Nemotron 3 Super beat one long, clever prompt, and a fast Nano model is plenty for phrasing facts the code already worked out.

### What's next for Pawzoo

- Run the evening digest as a scheduled Nebius Serverless Job, and host the MCP server on Nebius.
- A weekly digest: walks against bookings, food used, anything unusual.
- More pets per household.

## Product feedback (Nebius Token Factory and Nemotron)

- **Worked well:**
  - The OpenAI-compatible API meant tool calling worked on the first try with the standard `tools` format.
  - `GET /v1/models?verbose=true` returns per-token prices, so our spend guard prices calls from the source instead of a hard-coded table.
- **Friction:**
  - **The verbose model list names `tools` and `reasoning` as supported features, but not structured outputs.** We could not tell whether `response_format` with a JSON schema is honoured, so we used a forced tool call for structured answers (in another of our entries). A line in the docs on which features each model supports would help.
- **Suggestion:**
  - Document whether parallel tool calls are supported for each Nemotron model. Nemotron 3 Super returned one call per turn in our tests, which shaped our design.
