# ZUUND Phase 1 — implementation notes

This is the engineering record of how the Phase 1 specification is realised in this repo. It
is deliberately short on prose and long on where things live.

## Decisions taken where the spec was open or conflicted with the repo

| Topic            | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Why                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API framework    | NestJS (existing), not Next.js API routes                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The spec asks to reuse the existing architecture and not rewrite working code. The user web app is Next.js (React) at zuund.com.                                                      |
| Signup           | Email + password through the existing cookie-JWT auth                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Not specified. Verification is an admin action behind `verificationStatus`; an OTP/KYC provider can be added later without touching callers.                                          |
| Payment provider | Razorpay behind `PaymentProvider`; `mock` provider for dev, refused in production                                                                                                                                                                                                                                                                                                                                                                                                                                   | India-first. Only `PaymentsService` touches payment/pass/membership state.                                                                                                            |
| Refund on leave  | `REFUND_ON_LEAVE=NONE` by default, `FULL` available                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Spec: make it configurable, do not invent a rule.                                                                                                                                     |
| Vote changes     | Off unless the poll creator enables `allowVoteChange`                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Spec: do not assume changes are allowed.                                                                                                                                              |
| Activity time    | `date` (YYYY-MM-DD) + `startTime`/`endTime` (HH:MM) as the spec lists                                                                                                                                                                                                                                                                                                                                                                                                                                               | Stored as given; treated as India local time.                                                                                                                                         |
| Collectives      | One ACTIVE collective per car + city; "create" returns the existing one                                                                                                                                                                                                                                                                                                                                                                                                                                             | Spec: keep formation simple; relevant buyers come together.                                                                                                                           |
| Realtime         | Polling for messages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | No websocket requirement in Phase 1; adding a gateway later does not change the API.                                                                                                  |
| Clients          | One Expo app (`apps/mobile`) for iOS, Android and the web at app.zuund.com; zuund.com (`apps/web`) is the marketing site                                                                                                                                                                                                                                                                                                                                                                                            | One codebase for the product. Web signs in with the API's httpOnly cookies, phones with bearer tokens in the keychain. Old zuund.com app URLs redirect to the same screen in the app. |
| Desktop web      | Sidebar + centred 760px column at ≥1024px; bottom tab bar below that                                                                                                                                                                                                                                                                                                                                                                                                                                                | A personal dashboard rather than an admin one.                                                                                                                                        |
| Free places      | Each collective has `FREE_MEMBERS_PER_COLLECTIVE` (5) free places, held by current members who joined free (₹0 pass); when one leaves or their pass expires, the place opens again for the next person to join                                                                                                                                                                                                                                                                                                      | User rule. Free members get a ₹0 pass with the normal 60-day validity and no Payment row. Claimed under a row lock on the collective.                                                 |
| Joining          | Creating a Buying Post is free and joins nothing. The user joins the collective for its item + city when they choose to, taking a free place if one is open, otherwise paying for the Buying Pass then. Until a membership is ACTIVE a user can't see other buyers, open profiles, send or accept connection requests, or send direct messages (`JOIN_COLLECTIVE_FIRST`); only the buyer count is open                                                                                                              | User request: pay only when joining; nothing between buyers before joining.                                                                                                           |
| Location         | GeoNames countries + cities of 15k+ people (~32k cities); DB-IP City Lite IP lookup (self-hosted, CC BY 4.0) pre-selects country and city                                                                                                                                                                                                                                                                                                                                                                           | User asked for all countries and IP-based suggestions. The IP guess is only pre-selected; the user confirms. IPs never leave the server.                                              |
| Categories       | Cars: 247 models from 34 brands on sale in India (`apps/backend/prisma/data/cars.json`, verified 2026-09-23, sources in the file); pick a brand (popular ones first), then a model, filterable by body type. No manufacturer logos or photos: ZUUND's own body-type drawings (`@zuund/shared` vehicles). Rooftop solar by size only (every size from 1 to 10 kW, plus 10+ kW; no brands). `cars.category` + `segment`; table and API names stay `car`/`carId`. Retired catalog rows are set INACTIVE, never deleted | User requests. Posts, discovery, collectives and passes are per catalog item, so nothing else changed.                                                                                |
| Mockup wording   | "Buying Pass" (not "Group Pass"); no deal/discount/negotiation promises; no 90-day timeline                                                                                                                                                                                                                                                                                                                                                                                                                         | Spec §6, §9, §92 win over mockup copy.                                                                                                                                                |

## Architecture

```
apps/web (Next.js)   apps/admin-dashboard (React Router)   [React Native later]
        └──────────────────────┬──────────────────────────────┘
                     apps/backend (NestJS)  /api/*
   controllers (zod validation) → guards (JwtAccessGuard, RolesGuard) → services → Prisma → PostgreSQL
```

Business rules live only in `apps/backend/src/**/*.service.ts`. Frontends render DTOs from
`packages/shared` and never decide access, amounts, expiry, or roles.

Money path: client → `POST /api/payments` → provider order → checkout → `POST /api/payments/verify`
(signature checked) **and/or** provider webhook (`POST /api/payments/webhook`, HMAC over raw body,
each event id recorded once) → `PaymentsService.activate()` in one transaction → Payment SUCCESS →
BuyingPass ACTIVE (activatedAt, expiresAt = +60 days) → CollectiveMembership ACTIVE → conversation
member added → notifications.

## Where each invariant is enforced

| #       | Invariant                                                 | Enforcement                                                                                                                                                                         |
| ------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | One ACTIVE post per user+car+city                         | Partial unique index `buying_intents_one_active_per_user_car_city` + pre-check in `BuyingIntentsService.create/transition`                                                          |
| 3       | Post can exist without a pass                             | `BuyingPass` is optional; posts are created free                                                                                                                                    |
| 4, 5, 6 | Pass belongs to exactly one post; ₹500 per post           | `BuyingPass.buyingIntentId`; `PaymentsService.create` refuses a second active pass per intent; there is no user-level paid flag anywhere                                            |
| 7, 11   | Pass ACTIVE only after verified payment (or a free place) | `PaymentsService.activate()` after signature/webhook verification; the one exception is `PaymentsService.claimFreePlace()` for a collective's first 5 members (₹0 pass, no payment) |
| 8, 9    | Pass never ACTIVE past expiresAt; 60 days from payment    | `expiresAt` computed server-side in `activate()`; `JobsService.expirePasses` every 5 min; `BUYING_PASS_VALIDITY_DAYS` capped at 60                                                  |
| 10      | Timeline ≠ validity                                       | Separate columns on separate tables; never derived from each other                                                                                                                  |
| 12, 13  | Duplicate webhooks/requests                               | `payment_webhook_events (provider, providerEventId)` unique; `payments.idempotencyKey` unique; `activate()` is a no-op on SUCCESS                                                   |
| 14      | One live membership per collective+user                   | Partial unique index `collective_memberships_one_live_per_user`                                                                                                                     |
| 15      | No double vote on single-choice                           | `PollsService.vote` transaction + `(pollId,userId,optionId)` unique                                                                                                                 |
| 16      | Private collective content                                | `CollectivesService.requireActiveMember` on polls, files, activities; discussion via `ConversationsService.requireMember` (members added only by `activate()` / `claimFreePlace()`) |
| 17, 18  | Only the owner modifies posts/payments                    | `requireOwned` / userId checks in every service method                                                                                                                              |
| 19      | No private contact info                                   | `toPublicUser` never includes email/phone; buyer cards and profiles use it                                                                                                          |
| 20      | Admin checked server-side                                 | `@Roles('ADMIN')` + `RolesGuard` on the whole `AdminController`; `JwtAccessGuard` re-reads role and status on every request                                                         |

## Errors, limits, files, audit (spec §77–§87)

- **Error envelope.** Every error is `{ success: false, error: { code, message, details? } }`
  (`apps/backend/src/common/api-exception.filter.ts`). Business failures throw `DomainException`
  with a stable code from `common/domain.exception.ts` (for example `DUPLICATE_ACTIVE_POST`,
  `NOT_CONNECTED`, `BUYING_PASS_REQUIRED`, `BUYING_PASS_EXPIRED`, `JOIN_FIRST`,
  `PASS_ALREADY_ACTIVE`, `PAYMENT_VERIFICATION_FAILED`, `ALREADY_VOTED`). Validation failures are
  `VALIDATION_FAILED` with `details: [{ path, message }]`. Prisma and provider errors never reach a
  client; they are logged with the request path.
- **Rate limits** (`@nestjs/throttler`, per client IP behind nginx): register 5/min, login and
  token 10/min, refresh 30/min, payment create 10/min, verify 20/min, messages 60/min, connection
  requests 30/min, uploads 30/min, everything else 300/min. The webhook is exempt (it is
  authenticated by signature).
- **Files.** Uploads are validated by extension, MIME type, size (`UPLOAD_MAX_BYTES`) and a
  magic-number check, stored outside any web root, and read back only through `GET /api/files/:id`,
  which allows the uploader, members of a conversation the file was sent to, ACTIVE members of a
  collective it was shared in, and any signed-in user for a profile photo.
- **Audit trail** (`audit_logs`, `actorType` USER | ADMIN | SYSTEM): post created/changed/paused/
  resumed/closed, intent level changed, connection requested/accepted, user blocked, collective
  created/joined/left, poll created/voted, report created, payment initiated/succeeded/failed/
  refunded, pass activated/expired, membership activated, and every admin action. Each row also
  emits a structured log line (`[Audit] ACTION actor=… Target#id`) so pm2 logs carry the same
  events. Authentication failures, webhook receipts and signature failures are logged too; no
  payment credentials are ever logged.
- **Concurrency.** Partial unique indexes for the three business invariants, `SELECT … FOR UPDATE`
  on the payment row inside `activate()` and on the poll row inside `vote()`, unique
  `(userLowId, userHighId)` for connections, unique provider event ids for webhooks, and unique
  idempotency keys for payments.

## Data model

See `apps/backend/prisma/schema.prisma`. Migration `20260922114135_phase1` adds the three partial
unique indexes by hand (Prisma cannot express them). Money is integer paise.

## API surface

All routes are under `/api`. Lists return `{ items, nextCursor }` (cursor = opaque keyset over
createdAt/id). Request bodies are validated with the zod schemas in `packages/shared/src/domain/schemas.ts`,
which the frontends also use.

| Area           | Routes                                                                                                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth           | `POST auth/register`, `auth/login`, `auth/token` (bearer, for mobile), `auth/refresh`, `auth/logout`, `auth/change-password`, `GET auth/me`                                                                                                                |
| Users          | `GET users/me`, `PATCH users/me`, `GET users/:id` (public profile)                                                                                                                                                                                         |
| Catalog        | `GET cars?q=&category=CAR\|SOLAR&brand=`, `GET cars/brands?category=`, `GET countries`, `GET cities?country=IN&q=` (biggest first), `GET geo` (IP guess)                                                                                                   |
| Files          | `POST files` (multipart `file`)                                                                                                                                                                                                                            |
| Buying intents | `POST/GET buying-intents`, `GET/PATCH buying-intents/:id`, `POST …/intent-level`, `GET …/history`, `POST …/status` {PAUSE                                                                                                                                  | RESUME                                                                                                    | CLOSE}   |
| Discovery      | `GET buyers?carId&cityId&filter=ALL                                                                                                                                                                                                                        | RECENT                                                                                                    | READY    | COMMITTED | INTERESTED`, `GET buyers/count` |
| Connections    | `GET connections?box=`, `POST connections`, `POST connections/:id/accept                                                                                                                                                                                   | reject`, `DELETE connections/:id`, `POST connections/block                                                | unblock` |
| Messaging      | `GET conversations`, `POST conversations/direct`, `GET/POST conversations/:id/messages`, `POST conversations/:id/read`, `POST messages/:id/reactions`, `DELETE messages/:id`                                                                               |
| Collectives    | `GET/POST collectives`, `GET collectives/:id`, `POST …/join`, `POST …/leave`, `GET …/members`, `GET/POST …/polls`, `POST polls/:id/vote                                                                                                                    | close`, `GET/POST …/files`, `DELETE shared-files/:id`, `GET/POST …/activities`, `POST activities/:id/rsvp | cancel`  |
| Payments       | `POST payments`, `POST payments/verify`, `POST payments/webhook`, `GET payments`, `GET payments/:id`, `GET buying-passes`, `GET buying-passes/:id`                                                                                                         |
| Notifications  | `GET notifications`, `GET notifications/unread-count`, `POST notifications/:id/read`, `POST notifications/read-all`                                                                                                                                        |
| Reports        | `POST/GET reports`                                                                                                                                                                                                                                         |
| Admin          | `GET admin/stats`, `admin/cities-in-use`, `admin/users[/:id][/action]`, `admin/buying-intents[/:id][/close]`, `admin/collectives[/:id][/action]`, `admin/payments[/:id][/refund]`, `admin/buying-passes`, `admin/reports[/:id/action]`, `admin/audit-logs` |

## Scheduled jobs (`apps/backend/src/jobs`)

Every 5 minutes: expire passes past `expiresAt` (and the memberships riding on them), close expired
polls. Every hour: "expires in 7 days" and "expires tomorrow" notifications, deduplicated by key.
Jobs are idempotent so both pm2 instances may run them.

## Razorpay setup (production)

1. Create a key pair in the Razorpay dashboard (test mode first).
2. Put `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` in `/srv/zuund/.env`.
3. Add a webhook at `https://api.zuund.com/api/payments/webhook` for `payment.captured`,
   `payment.failed`, `refund.processed`, with a secret; put it in `RAZORPAY_WEBHOOK_SECRET`.
4. `pm2 reload zuund-api --update-env` (or push any commit).

Until real keys are set, the server holds placeholders: the API boots, but creating a payment
returns a 502 from the provider step and no pass can be activated.

## Verification

Automated: `pnpm --filter @zuund/backend test` (Vitest + supertest against a dedicated
`zuund_test` database; see `apps/backend/test`). It covers every bullet of spec §81.

Manual: a smoke script exercised 130+ assertions end to end against a running API:
catalog, registration, post lifecycle and history, discovery counts and filters, connections and
the single-row-per-pair rule, messaging delivery states, collective join/pay/activate via both
checkout verification and webhook (including duplicate webhook), 60-day expiry, polls incl.
single/multi-choice rules, files, activities, blocking, leaving, refunds, admin actions and audit
logs. The same script is easy to re-run against a fresh database.
