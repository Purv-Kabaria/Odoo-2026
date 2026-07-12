# syntax=docker/dockerfile:1

# Multi-stage build: only the traced `.next/standalone` output and static
# assets ship in the final image — no dev dependencies, no full
# node_modules tree, no source maps beyond what Next.js includes.

FROM node:22-alpine AS base
RUN corepack enable

# ---- Dependencies (cached separately from source so `pnpm install` only
# re-runs when the lockfile actually changes) ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- Build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma Client generation is intentionally not a postinstall hook (see
# pnpm-workspace.yaml's ignoredBuiltDependencies) so it must run explicitly.
RUN pnpm db:generate

# next build validates env vars (lib/env.ts) at module load time even
# though it never needs to reach the database. A syntactically valid
# placeholder is enough to build; the real value is supplied at `docker
# run` / compose time and is what the app actually connects with.
ARG DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV DATABASE_URL=${DATABASE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# ---- Runtime ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Migrations are NOT run from this image: the standalone output only traces
# the @prisma/client runtime, not the `prisma` CLI, and running
# `migrate deploy` from every replica of a horizontally-scaled app is a
# race condition anyway. Run `pnpm exec prisma migrate deploy` as its own
# deploy step (CI already does this) against the target DATABASE_URL
# before rolling out a new image.
USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
