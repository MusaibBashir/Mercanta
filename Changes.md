# Mercanta — Multi-Tenancy Expansion Changelog

> Covers Phase 1, 2, and 3 of the expansion that enables multiple independent shops
> (franchise units + restaurants) to operate on the same platform with isolated data,
> independent payments, and a full audit trail.

---

## Phase 1 — Per-Tenant Foundation

**Goal:** Give every shop its own independent identity and configuration so that a new
restaurant or franchise can be onboarded without touching any shared global config.

### Why it was needed

The original system had a single global Razorpay key, no per-shop address on receipts,
and customers were stored in a flat table with no tenant isolation. Adding a second shop
would have caused data leakage — customer lists, inventory, and sales would all be
visible across accounts.

---

### DB Changes

| Change | Why |
|--------|-----|
| Added `settings JSONB` column to `business_accounts` | Stores per-shop config (Razorpay key, address, GSTIN, tax rate, WhatsApp number) without needing extra table columns for every new setting |
| Added `business_account_id UUID` column to `customers` | Allows each shop to have its own customer list; legacy rows left with NULL so existing data is not broken |
| Added RLS `SELECT` policy on `inventory` | Franchise users can only read inventory belonging to their own franchise or the admin warehouse — previously all inventory was globally readable |
| Added RLS `INSERT/UPDATE` policies on `inventory` | Prevents a franchise from writing to another franchise's stock |
| Added RLS `SELECT/INSERT/UPDATE` policies on `customers` | Each shop's customers are isolated; a shop can still see "unscoped" (legacy) customers |

### Frontend Changes

| File | Change | Why |
|------|--------|-----|
| `AuthContext.tsx` | Added `BusinessAccountSettings` typed interface with `razorpay_key_id`, `shop_address`, `shop_city`, `shop_phone`, `shop_gstin`, `shop_tagline`, `default_tax_rate`, `whatsapp_number`, `features` | Gives full TypeScript type-safety over the JSONB settings blob |
| `AuthContext.tsx` | `BusinessAccount.settings` is now typed as `BusinessAccountSettings` | Propagates types to every component that reads `activeBusinessAccount` |
| `SalesPage.tsx` | Razorpay key now reads `activeBusinessAccount?.settings?.razorpay_key_id` first, falls back to `VITE_RAZORPAY_KEY_ID` env var | Each shop's Razorpay account receives the payment directly; the global key is just a safety fallback |
| `SalesPage.tsx` | Shop name and address on receipts and the Razorpay modal now come from `activeBusinessAccount.display_name` and `settings.shop_address` | Previously every receipt showed the same global shop name |
| `InventoryContext.tsx` | `findOrCreateCustomer` sets `business_account_id` on newly created customers; lookup is scoped to the active business account | Prevents a new customer created in Shop A from appearing in Shop B |
| `BusinessSettingsPage.tsx` | **New page** — lets an owner configure display name, address, city, phone, GSTIN, tagline, Razorpay publishable key, default tax rate, and WhatsApp number | Each shop owner can self-configure without an admin touching the database |
| `App.tsx` | Route `/settings/business` added | Wires the settings page into the router |
| `HamburgerMenu.tsx` | "Business Settings" link added to both franchise and restaurant navigation | Makes the settings page discoverable for all roles that need it |

---

## Phase 2 — Security, Data Integrity & Scale

**Goal:** Harden the system before adding more shops. Fix a Razorpay secret exposure,
correctly link all legacy franchise data, enforce DB-level permissions in the frontend,
and prevent the app from choking on large datasets.

### Why it was needed

- The Razorpay **secret** key (used for payment verification) was stored in `.env` as
  `VITE_RAZORPAY_KEY_SECRET` — meaning it was compiled into every user's browser bundle.
  Any visitor could open DevTools and extract it.
- The "Salt Lake" franchise was incorrectly linked to Park Street's `business_account_id`
  in the database, causing its sales and inventory to appear under the wrong account.
- The `permissions` table existed in the DB but was never read by the frontend. Any user
  who could log in could attempt any write operation.
- `InventoryContext` loaded all inventory and all sales with no limit, which would cause
  the app to crash or time out as data grew.

---

### DB Changes

| Change | Why |
|--------|-----|
| Fixed `create_order_token` RPC date filter | The old filter `DATE(created_at AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE AT TIME ZONE 'Asia/Kolkata'` compared a `date` to a `timestamptz` — PostgreSQL always returned 0 rows, so `MAX(token_number)` was always 0, the RPC always tried to claim token #1, and the unique constraint rejected it after 10 retries. Fixed to `(created_at AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date` |
| Replaced global unique constraint on `order_tokens` with per-day unique index | The old constraint was `UNIQUE(business_account_id, token_number)` — a restaurant could never reuse token #1 on a new day. The new partial unique index keys on `(business_account_id, token_number, (created_at AT TIME ZONE 'Asia/Kolkata')::date)` so tokens reset naturally each day |
| `UPDATE franchises SET business_account_id = '<correct-id>' WHERE name = 'Salt Lake'` | Data correction — Salt Lake was linked to Park Street's account, causing all its data to appear under the wrong tenant |
| Backfilled `business_account_id` on `inventory` and `sales` for all franchise units | Legacy rows had NULL, so tenant-scoped queries returned nothing for existing data |
| Seeded `permissions` rows for all business account owners with role `owner` and scope `all` | Without this, the new permission check in the frontend would have blocked all existing owners |
| Added `user_has_permission(scope, action)` DB function (optional helper) | Allows RLS policies to call a consistent permission check in future |

### Frontend Changes

| File | Change | Why |
|------|--------|-----|
| `.env` | Removed `VITE_RAZORPAY_KEY_SECRET` | The secret must never be in frontend code — it was compiled into the JS bundle and readable by anyone. Verification now happens via a Supabase Edge Function |
| `AuthContext.tsx` | Added `Permission` interface, `accountPermissions` state, `fetchPermissions(userId, accountId)` function, `hasPermission(scope, action)` function | Reads the `permissions` table from the DB and exposes a single callable gate for all write-guarded features |
| `AuthContext.tsx` | Permissions are loaded on login and re-loaded on `switchBusinessAccount`; cleared on sign-out | Keeps permission state fresh when a user switches between shops |
| `AuthContext.tsx` | `hasPermission` always returns `true` for global admins; checks the `all` scope row first, then falls back to the specific scope | Admins never get blocked; owners get full access via their `all`-scoped permission row |
| `SalesPage.tsx` | Added `const canSell = hasPermission('sales', 'write')`; `handleCompleteSale` returns early with a toast if `!canSell` | A viewer or read-only operator can browse the POS but cannot complete a sale |
| `InventoryContext.tsx` | Inventory query capped at `INVENTORY_LIMIT = 500` rows; sales query capped at `SALES_LIMIT = 200` rows | Prevents memory exhaustion as shops accumulate data. Pagination / infinite scroll can be added per-page when needed |
| `InventoryContext.tsx` | Inventory and sales queries now filter by `business_account_id` when the active account is set | A restaurant's POS only loads its own inventory and its own sales history |
| `InventoryContext.tsx` | Customers query uses `.or('business_account_id.eq.X,business_account_id.is.null')` | Shows the shop's own customers AND the legacy unscoped customers, so existing loyalty data is not lost |
| `FranchiseDashboard.tsx` | Recent orders query joins `order_tokens!order_tokens_sale_id_fkey(token_number)` and displays the real token number | Previously showed `idx + 1` (list index), which had no relation to the actual token assigned to the order |
| `FranchiseDashboard.tsx` | Added direct DB query for today's stats (orders count, revenue, pending count) | Context-level sales data is capped and may not include today's records in a busy shop |
| `KitchenDisplaySystem.tsx` | Card colour scheme changed to dark saturated backgrounds with white text and coloured left borders | The previous pastel backgrounds (e.g. `bg-blue-100`) blended with the light text on a dark KDS screen, making status nearly unreadable at a glance |
| `menuService.ts` | Fixed Supabase Realtime subscriptions from v1 API (`.on()` on query builder) to v2 channel API (`.channel().on('postgres_changes', ...)`) | The v1 API was removed in Supabase JS v2; the old code silently failed to subscribe |

---

## Phase 3 — Audit Trail & Soft Deletes

**Goal:** Ensure every data change is permanently recorded and recoverable. No record
should be permanently destroyed by a user action — only hidden from active queries.

### Why it was needed

- There was no way to know who changed a price, deleted an inventory item, or voided a
  sale. In a multi-franchise environment this is a compliance and accountability requirement.
- Hard deletes (`DELETE FROM inventory WHERE id = ?`) permanently destroyed records with
  no recovery path. A misclick by a franchise operator could silently erase stock history.
- The landing page already claimed "full audit history of every stock movement" — this
  phase makes that claim true.

---

### DB Changes

#### Audit Log

| Object | Detail |
|--------|--------|
| `audit_log` table | Columns: `id`, `table_name`, `record_id` (UUID as text), `operation` (INSERT/UPDATE/DELETE), `old_data` (JSONB snapshot before), `new_data` (JSONB snapshot after), `changed_by` (auth.users FK), `business_account_id` (extracted from the record), `changed_at` |
| Indexes | `(business_account_id, changed_at DESC)` for timeline queries; `(table_name, record_id)` for per-record history; `(changed_by)` for per-user history |
| RLS on `audit_log` | Global admins see all rows; non-admins see only rows where `business_account_id` is in their `permissions` table |
| `log_audit_event()` trigger function | Generic `SECURITY DEFINER` PL/pgSQL function; fires on any table it is attached to; uses `TG_TABLE_NAME` and `TG_OP` so one function serves all tables; extracts `business_account_id` from the record's own JSONB so it works on any table that has that column |
| Triggers | `audit_sales_trg` on `sales`, `audit_inventory_trg` on `inventory`, `audit_restaurant_menu_trg` on `restaurant_menu`, `audit_menu_categories_trg` on `menu_categories`, `audit_order_tokens_trg` on `order_tokens` — all `AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` |
| `get_audit_log(p_business_account_id, p_table_name, p_operation, p_limit, p_offset)` RPC | Paginated query joining `auth.users` to resolve `changed_by_email`; all parameters except business account are optional filters; respects the same RLS as direct table access |

#### Soft Deletes

| Object | Detail |
|--------|--------|
| `inventory.deleted_at TIMESTAMPTZ DEFAULT NULL` | NULL = active record; non-NULL = soft-deleted at that timestamp |
| `sales.deleted_at TIMESTAMPTZ DEFAULT NULL` | Same pattern for sales |
| Partial indexes | `CREATE INDEX inventory_active_idx ON inventory (business_account_id) WHERE deleted_at IS NULL` and equivalent for `sales` — ensures queries that filter active records use the index efficiently even as the deleted-records tail grows |
| `soft_delete_inventory_item(p_item_id UUID)` RPC | Sets `deleted_at = NOW()` only if currently NULL; the audit trigger fires automatically and records the UPDATE with the full `old_data` snapshot |
| `restore_inventory_item(p_item_id UUID)` RPC | Clears `deleted_at` — available for a future "Trash / Restore" UI |
| `soft_delete_sale(p_sale_id UUID)` RPC | Same pattern for sales; ready for future use |

### Frontend Changes

| File | Change | Why |
|------|--------|-----|
| `InventoryContext.tsx` | Inventory query adds `.is('deleted_at', null)` | Soft-deleted items are invisible to the POS and inventory pages without any change to consuming components |
| `InventoryContext.tsx` | Sales query adds `.is('deleted_at', null)` | Sales history and dashboard stats exclude voided/deleted sales automatically |
| `InventoryContext.tsx` | `deleteInventoryItem` now calls `supabase.rpc('soft_delete_inventory_item', ...)` instead of `.delete()` | The record is preserved in the DB and captured in the audit log; the local React state still filters it out immediately for a snappy UI |
| `AuditLogPage.tsx` | **New page** — paginated table of audit log entries with filter by table and operation type; shows relative timestamps, human-readable record summaries (e.g. "Biryani — ₹180.00" instead of a raw UUID), and the email of the user who made the change | Gives admins and shop owners visibility into every data mutation without needing direct DB access |
| `App.tsx` | Route `/audit-log` added, protected to `admin` role | Audit log is visible to central admins; per-account access can be opened to owners in a future iteration |
| `HamburgerMenu.tsx` | "Audit Log" link with Shield icon added to the admin navigation section | Makes the audit trail discoverable from the main nav |

---

## Bug Fixes Applied During This Work

These were fixed alongside the phase work because they blocked correct operation.

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Token generation failing with "Failed after 10 attempts" | `create_order_token` RPC date comparison always returned 0 rows, so `MAX(token_number)` was always 0 and the RPC tried to claim #1 forever | Fixed date cast in the RPC; replaced global unique constraint with per-day unique index |
| Dashboard showing wrong token numbers (1, 2, 3…) | `FranchiseDashboard` used `idx + 1` (array index) instead of the actual token number | Query now joins `order_tokens!order_tokens_sale_id_fkey(token_number)`; displays `sale.order_tokens?.[0]?.token_number` |
| Dashboard fetch error PGRST201 (ambiguous relationship) | `order_tokens` has two FK relationships to `sales`; PostgREST could not determine which to use without a hint | Explicit FK hint added: `order_tokens!order_tokens_sale_id_fkey` |
| KDS card text unreadable | Pastel backgrounds (`bg-blue-100`) with light-coloured text on a dark KDS display | Cards changed to dark saturated backgrounds with white text and a coloured left border per status |
| TypeScript build errors (TS18047 supabase possibly null) | `supabase` is typed as `SupabaseClient \| null` but was called without null guard across 9 files | Added `!` non-null assertions (`supabase!.rpc(...)`) throughout all service and component files |
| TypeScript build errors (TS7006 implicit any) | Callback parameters in `onValueChange`, `onCheckedChange`, and `onClick` handlers were untyped because versioned shadcn imports break tsc module resolution | Explicit type annotations added (`: string`, `: boolean`, `: React.MouseEvent`) |
| `ForecastPage` calling non-existent function | `fetchProphetForecasts()` was called but the function is named `triggerRefresh()` | Corrected the call site |
| Razorpay secret in client bundle | `VITE_RAZORPAY_KEY_SECRET` was in `.env` and compiled into the JS bundle | Removed from `.env`; secret lives only in Supabase Edge Function environment variables |
| Salt Lake franchise linked to wrong account | `franchises.business_account_id` pointed to Park Street's account | Data corrected via targeted SQL update |

---

## What Each Shop Owner Needs To Do (One-Time Onboarding)

1. Open the **hamburger menu** → **Business Settings**
2. Fill in shop name, address, city, phone, and GSTIN — these print on every receipt
3. Paste your own **Razorpay publishable key** (the `rzp_live_...` key from your Razorpay dashboard) — payments go directly to your Razorpay account
4. Set the **default tax rate** for your shop
5. Enter the **WhatsApp Business number** if you use the n8n WhatsApp order workflow
6. Save — changes apply immediately on next page load

---

*Generated: 2026-03-28*
