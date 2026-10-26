# Pawzoo, Nebius edition: one image for the MCP server and for the evening digest job.
#   Server:  docker run -p 8787:8787 -e HOST=0.0.0.0 -e NEBIUS_API_KEY=... -e PAWZOO_BUDGET_USD=0.15 pawzoo
#   Job:     docker run -e PAWZOO_URL=https://your-pawzoo -e PAWZOO_JOB_TOKEN=... -e NEBIUS_API_KEY=... -e PAWZOO_BUDGET_USD=0.05 pawzoo node server/dist/jobs/evening-digest.js
# The job is the unit to schedule as a Nebius Serverless Job (daily, 19:00 in the family's time zone).
FROM node:22-slim AS build
WORKDIR /app
COPY server/package.json server/package-lock.json server/
COPY web/package.json web/package-lock.json web/
RUN npm --prefix server ci && npm --prefix web ci
COPY . .
RUN npm run build && npm --prefix server prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/dist-views server/dist-views
COPY --from=build /app/server/node_modules server/node_modules
COPY --from=build /app/server/package.json server/package.json
COPY --from=build /app/web/dist web/dist
COPY --from=build /app/media media
EXPOSE 8787
CMD ["node", "server/dist/index.js"]
