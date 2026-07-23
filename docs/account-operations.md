# Account Operations

This document explains the customer account backend.

## Schema

The customer account backend uses existing tables:

- `users` — Better Auth users. Extended with `mobile`, `account_deletion_requested_at`, `data_export_requested_at`.
- `customers` — one row per checkout. Has `userId` (nullable for guest checkouts). After guest-order linking, `userId` is set.
- `addresses` — saved delivery addresses per customer.
- `orders` — orders, linked to a `customerId`.

## Customer ↔ User relationship

A single user can have multiple customer rows:

- One created when the user first authenticates and creates a customer record (via `ensureCustomerForUser`).
- One per guest checkout where the customer email matches the user's verified email (before linking).

After `claimGuestOrdersForUser`, all customer rows for that email are linked to the user. The user's order history then includes all of those customer rows' orders.

## Order history

`listOrdersForUser({ userId, page, pageSize })`:

1. Finds all `customers` rows where `userId = $1`.
2. Queries `orders` where `customerId IN (...)` those customer IDs.
3. Returns paginated results ordered by `createdAt DESC`.

`getOrderForUser(userId, orderNumber)`:

1. Finds the user's customer IDs.
2. Queries `orders` where `orderNumber = $1 AND customerId IN (...)`.
3. Returns null if not owned — never throws.

## Guest order linking

`claimGuestOrdersForUser({ userId, email })`:

1. Finds all `customers` rows where `email = $1 (lowercase)` AND `userId IS NULL`.
2. For each, sets `userId = $2` and records an audit entry.
3. Returns `{ claimed, skipped }`.

This is safe because:

- Only the user with the verified email can claim (Better Auth enforces email verification).
- Already-linked orders are skipped.
- The audit log records the link for traceability.

## Saved addresses

`listAddressesForUser(userId)`:

1. Finds the user's customer IDs.
2. Returns all `addresses` rows for those customer IDs, ordered by `isDefault DESC, updatedAt DESC`.

`createAddressForUser({ userId, ... })`:

1. Ensures a customer row exists.
2. Enforces `max_addresses_per_user` (default 10).
3. If `isDefault`, clears the previous default.
4. Inserts the new address.
5. Records an audit entry.

`updateAddressForUser({ userId, addressId, ... })`:

1. Verifies the address belongs to one of the user's customer IDs.
2. If `isDefault`, clears the previous default.
3. Updates the address.
4. Records an audit entry.

`deleteAddressForUser({ userId, addressId })`:

1. Verifies ownership.
2. Checks if the address is referenced by an order. If so:
   - Sets `isDefault = false` (to allow the user to set a new default).
   - Throws `AccountError` with code `in_use` — the address is NOT deleted (historical integrity).
3. Otherwise deletes the address.
4. Records an audit entry.

## Profile

`updateUserProfile({ userId, name?, mobile? })`:

1. Updates the `users` row.
2. Syncs the name and mobile to all linked `customers` rows.
3. Records an audit entry.

Email is read-only — it is the identity anchor. Password changes go through Better Auth's forgot-password flow.

## Data export and deletion requests

`requestAccountAction({ userId, action })`:

- For `export`: sets `users.data_export_requested_at = now()`.
- For `deletion`: sets `users.account_deletion_requested_at = now()`.

The request is RECORDED but not FULFILLED. The owner must:

1. Contact the customer to verify identity.
2. For export: compile the user's data and deliver it securely.
3. For deletion: anonymise or delete the user's records in compliance with applicable law (GST retention, order history retention, etc.).

This separation ensures the owner can apply business policy and legal retention rules — Z-AI must not auto-delete customer data.

## API routes

- `GET /api/account/addresses` — list saved addresses.
- `POST /api/account/addresses` — create a saved address.
- `PATCH /api/account/addresses/[id]` — update a saved address.
- `DELETE /api/account/addresses/[id]` — delete a saved address.
- `POST /api/account/orders/[orderNumber]/claim` — claim guest orders by verified email.
- `PATCH /api/account/profile` — update name and mobile.
- `POST /api/account/profile` — submit a data export or account deletion request.

All routes require a valid Better Auth session. Unauthenticated requests receive HTTP 401.

## UI

- `/account` — landing page with links to orders, addresses, profile.
- `/account/orders` — order history with a "Claim guest orders" button.
- `/account/orders/[orderNumber]` — order detail (ownership-checked).
- `/account/addresses` — saved addresses manager.
- `/account/profile` — profile editor + data export/deletion request buttons.

## Failure modes

- **User attempts to access another user's order** — `getOrderForUser` returns null, the page returns 404.
- **User attempts to delete an address referenced by an order** — `deleteAddressForUser` throws `AccountError` with code `in_use`, the API returns HTTP 409.
- **User exceeds the address limit** — `createAddressForUser` throws `AccountError` with code `max_addresses`, the API returns HTTP 400.
- **User claims guest orders with an unverified email** — Better Auth enforces email verification before sign-in, so this cannot happen.
