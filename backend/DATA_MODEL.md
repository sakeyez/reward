# Backend Data Model Plan

This document defines the first backend design phase for the AI learning
check-in and reward system. It is intentionally implementation-ready, but it
does not require the database code to exist yet.

## Product Scope

The backend needs to support three surfaces:

- User app: students submit learning check-ins, receive AI scores, earn points,
  view calendars, and redeem rewards.
- Admin app: operators manage users, review records, adjust points, maintain
  reward goods, and inspect redemption history.
- API layer: shared authentication, authorization, database access, and business
  services for both apps.

## Core Entities

### users

Stores account identity and denormalized point balance.

| Field | Type | Notes |
| --- | --- | --- |
| id | integer / uuid | Primary key |
| username | string | Unique login name, optional if phone login is primary |
| phone | string | Unique, nullable during early development |
| email | string | Unique, nullable |
| password_hash | string | Never store plain passwords |
| display_name | string | Name shown in the app |
| avatar_url | string | Optional |
| current_points | integer | Cached current balance |
| streak_days | integer | Cached continuous check-in count |
| status | enum | `active`, `disabled` |
| created_at | datetime | Server timestamp |
| updated_at | datetime | Server timestamp |

Notes:

- `current_points` is kept for fast reads, but the reliable audit trail is
  `point_transactions`.
- Users should not be deleted physically after they have check-ins, points, or
  redemptions. Disable them with `status`.

### roles

Stores permission groups.

| Field | Type | Notes |
| --- | --- | --- |
| id | integer / uuid | Primary key |
| code | string | Unique, for example `user`, `admin`, `super_admin` |
| name | string | Display name |
| description | string | Optional |
| created_at | datetime | Server timestamp |

### user_roles

Many-to-many relation between users and roles.

| Field | Type | Notes |
| --- | --- | --- |
| user_id | foreign key | References `users.id` |
| role_id | foreign key | References `roles.id` |
| created_at | datetime | Server timestamp |

### checkins

Stores one learning submission and its overall AI result.

| Field | Type | Notes |
| --- | --- | --- |
| id | integer / uuid | Primary key |
| user_id | foreign key | References `users.id` |
| checkin_date | date | Business date shown on calendar |
| content_text | text | User note or prompt text |
| image_url | string | Uploaded learning evidence |
| status | enum | `draft`, `submitted`, `analyzing`, `scored`, `rejected` |
| total_score | integer | 0-100, nullable before scoring |
| awarded_points | integer | Points earned by this check-in |
| ai_comment | text | AI summary |
| ai_advice | text | AI next-step suggestion |
| created_at | datetime | Server timestamp |
| updated_at | datetime | Server timestamp |

Recommended constraints:

- Unique `(user_id, checkin_date)` if the product only allows one check-in per
  day.
- If multiple submissions per day are allowed later, add `attempt_no` and keep
  a separate "daily winning check-in" rule.

### checkin_score_dimensions

Stores detailed score dimensions for one check-in.

| Field | Type | Notes |
| --- | --- | --- |
| id | integer / uuid | Primary key |
| checkin_id | foreign key | References `checkins.id` |
| dimension_code | string | For example `completion`, `clarity` |
| dimension_name | string | For example `完成度`, `清晰度` |
| score | integer | 0-100 |
| sort_order | integer | Display order |

### point_transactions

Stores every point increase or decrease.

| Field | Type | Notes |
| --- | --- | --- |
| id | integer / uuid | Primary key |
| user_id | foreign key | References `users.id` |
| type | enum | `checkin_reward`, `redemption_cost`, `admin_adjustment`, `refund` |
| amount | integer | Positive for earning, negative for spending |
| balance_after | integer | User balance after this transaction |
| related_type | string | `checkin`, `redemption`, `admin_action`, nullable |
| related_id | string | Related entity id, nullable |
| reason | string | Human-readable reason |
| created_by | foreign key | Admin user id, nullable |
| created_at | datetime | Server timestamp |

Rules:

- All point changes must go through a point service.
- `users.current_points` and `point_transactions` must be updated in one
  database transaction.
- Do not update `users.current_points` directly from route handlers.

### rewards

Stores redeemable goods or virtual benefits.

| Field | Type | Notes |
| --- | --- | --- |
| id | integer / uuid | Primary key |
| name | string | Reward name |
| category | string | For example `stationery`, `course`, `member`, `virtual` |
| description | text | Optional |
| image_url | string | Optional |
| cost_points | integer | Required points |
| stock | integer | Nullable means unlimited |
| status | enum | `active`, `inactive` |
| created_at | datetime | Server timestamp |
| updated_at | datetime | Server timestamp |

### redemptions

Stores reward exchange orders.

| Field | Type | Notes |
| --- | --- | --- |
| id | integer / uuid | Primary key |
| user_id | foreign key | References `users.id` |
| reward_id | foreign key | References `rewards.id` |
| cost_points | integer | Snapshot of reward cost at purchase time |
| status | enum | `created`, `fulfilled`, `cancelled`, `refunded` |
| receiver_name | string | Optional for physical rewards |
| receiver_phone | string | Optional for physical rewards |
| receiver_address | string | Optional for physical rewards |
| created_at | datetime | Server timestamp |
| updated_at | datetime | Server timestamp |

Rules:

- Creating a redemption checks user balance and reward stock.
- Successful redemption creates a negative `point_transactions` row.
- If physical rewards are not needed yet, receiver fields can stay nullable.

## Relationship Overview

```text
users 1--many checkins
checkins 1--many checkin_score_dimensions

users 1--many point_transactions
checkins 1--0/1 point_transactions
redemptions 1--0/1 point_transactions

users many--many roles through user_roles

users 1--many redemptions
rewards 1--many redemptions
```

## Main Business Flows

### User Login

```text
user submits username/phone + password
-> verify password hash
-> issue access token
-> frontend calls /api/users/me
```

### Learning Check-In

```text
user uploads image and/or text
-> create checkins row with submitted/analyzing status
-> AI or temporary scorer produces total score and dimensions
-> update checkins to scored
-> create positive point transaction
-> update users.current_points and streak_days
```

During early development, the AI scorer can be a fake service returning stable
test data. The important part is keeping the same service boundary.

### Reward Redemption

```text
user selects reward
-> backend checks reward active, stock, and user balance
-> create redemptions row
-> create negative point transaction
-> update users.current_points
-> decrease stock when stock is not unlimited
```

### Admin Point Adjustment

```text
admin selects user and adjustment amount
-> backend verifies admin role
-> create point transaction with type admin_adjustment
-> update users.current_points
```

## Suggested API Boundaries

The exact implementation can change, but the first backend build should target
these boundaries.

### Auth

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/users/me
```

### User App

```text
POST /api/checkins
GET  /api/checkins/me
GET  /api/checkins/calendar
GET  /api/checkins/{checkin_id}

GET  /api/rewards
POST /api/redemptions
GET  /api/redemptions/me
GET  /api/points/me
```

### Admin App

```text
GET   /api/admin/users
GET   /api/admin/users/{user_id}
PATCH /api/admin/users/{user_id}
POST  /api/admin/users/{user_id}/point-adjustments

GET   /api/admin/checkins
GET   /api/admin/point-transactions

GET   /api/admin/rewards
POST  /api/admin/rewards
PATCH /api/admin/rewards/{reward_id}

GET   /api/admin/redemptions
PATCH /api/admin/redemptions/{redemption_id}
```

## Implementation Order For Phase 2

1. Add app configuration and database session setup.
2. Add SQLAlchemy base model mixins for id and timestamps.
3. Implement `users`, `roles`, and `user_roles`.
4. Add Alembic and generate the first migration.
5. Implement auth schemas and password hashing.
6. Add register, login, and `/api/users/me`.
7. Add check-in models and temporary scoring service.
8. Add point transaction service.
9. Add rewards and redemptions.
10. Add admin routes after role checks exist.

## Decisions To Revisit Later

- Use integer primary keys for speed and simplicity, or UUIDs for public ids.
- Whether one user can submit more than one check-in per day.
- Whether reward delivery needs shipping information in the first release.
- Whether admin roles need fine-grained permissions beyond `admin`.
- Whether `current_points` should be eventually recalculated by scheduled jobs
  to detect drift from `point_transactions`.
