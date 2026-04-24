# ⬡ Mercanta

> **Multi-tenant franchise & retail management platform — POS, inventory, KDS, forecasting, and loyalty in one system.**

🌐 **Live:** [https://mercanta.in](https://mercanta.in)

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Routes](#routes)
- [Database Schema](#database-schema)
- [Context Architecture](#context-architecture)
- [Services](#services)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)

---

## Overview

Mercanta is a full-stack business management platform built for franchise networks, standalone shops, and restaurants. It supports multi-tenant business accounts, role-based access (admin vs. franchise), a full POS terminal, real-time inventory management, a kitchen display system (KDS), AI-powered demand forecasting, and a customer loyalty programme.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend Framework | React 18 | Functional components & hooks only |
| Language | TypeScript | Strict mode; all components and contexts fully typed |
| Router | React Router v7 | HashRouter (`/#/path`); routes defined in `App.tsx` |
| Styling | Tailwind CSS v3 | Utility-first; no separate CSS files |
| UI Components | shadcn/ui + Radix UI | Accessible primitives in `src/components/ui/` |
| Database | Supabase (PostgreSQL) | Row-Level Security on all tables; Realtime subscriptions |
| Auth | Supabase Auth | Email/password; JWT in localStorage; 1h access token, 7d refresh |
| Build Tool | Vite 6 | HMR dev server on port 3000; output in `dist/` |
| Backend / ML | Flask + Prophet | Python forecasting server — optional, app runs without it |
| Payments | Razorpay | Webhook verified via HMAC in Supabase Edge Function |
| Edge Functions | Deno (Supabase) | `razorpay-webhook` function uses service role key |

---

## Features

### Multi-Tenant Business Accounts
Users can own and switch between multiple `business_accounts`. Every data query is scoped to the active account, enabling a single user to manage a standalone shop and a restaurant simultaneously. Built on `business_accounts`, `active_account_sessions`, and `permissions` tables with `AccountSwitcher` and `BusinessSetupModal` components.

### Franchise System
Admins manage a network of franchise units. Warehouse stock (`franchise_id = null`) is transferred to franchises via stock orders. Each franchise has fully isolated data views enforced by Row-Level Security. Key pages: `ManageFranchisesPage`, `StockOrdersPage`, `OrderStockPage`, `FranchiseDetailPage`.

### Restaurant / Kitchen Display System (KDS)
When `business_type` is `restaurant`, `SalesPage` generates order tokens. `KitchenDisplaySystem` displays a live token board. Tokens follow a defined status workflow, with daily numbering resetting at midnight. Backed by `tokenService` and `menuService`.

### Customer Loyalty Points
Customers are identified by phone number. Spend ₹100 to earn 1 point; redeem at ₹1 per point. Balance is shown at checkout and the redemption amount is deducted from the sale total.

### Advanced POS Pricing
Item-level discounts (percent or flat), cart-level discounts, configurable tax rate, and split payment across cash / UPI / card. All computed in `SalesPage.calculateTotals()`.

### Demand Forecasting
Sales data is sent to a Flask + Facebook Prophet backend. Returns per-SKU forecasts with confidence intervals. Falls back to client-side linear regression if the backend is unavailable.

### Realtime Data Sync
Supabase Realtime subscriptions on `inventory`, `stock_orders`, and `order_tokens`. Any change from any client reflects instantly without a page reload.

---

## Project Structure

```
src/
├── context/
│   ├── AuthContext.tsx        # Auth, profiles, business account switching
│   └── InventoryContext.tsx   # Inventory, sales, customers, stock orders
├── pages/
│   ├── LoginPage.tsx
│   ├── FranchiseDashboard.tsx
│   ├── SalesPage.tsx
│   ├── InventoryPage.tsx
│   ├── SalesHistoryPage.tsx
│   ├── CustomersPage.tsx
│   ├── ForecastPage.tsx
│   ├── OrderStockPage.tsx
│   ├── RestaurantMenuPage.tsx
│   ├── KitchenDisplaySystem.tsx
│   ├── TokenTracker.tsx
│   └── admin/
│       ├── AdminDashboard.tsx
│       ├── ManageFranchisesPage.tsx
│       ├── FranchiseDetailPage.tsx
│       ├── FinancialReportsPage.tsx
│       ├── AdminInventoryPage.tsx
│       ├── StockOrdersPage.tsx
│       └── AddItemsPage.tsx
├── components/
│   ├── ProtectedRoute.tsx
│   ├── HamburgerMenu.tsx
│   ├── AccountSwitcher.tsx
│   ├── CameraScanner.tsx
│   ├── BusinessSetupModal.tsx
│   ├── InvoiceModal.tsx
│   ├── TokenTracker.tsx
│   ├── RestaurantSettings.tsx
│   └── layout/
│       ├── MainLayout.tsx
│       └── PageContainer.tsx
├── services/
│   ├── tokenService.ts
│   ├── menuService.ts
│   └── forecastService.ts
└── lib/
    └── supabaseClient.ts
```

---

## Routes

| Path | Component | Role | Description |
|---|---|---|---|
| `/` | `RoleRedirect` | public | Redirects admin → `/admin`, franchise → `/dashboard` |
| `/login` | `LoginPage` | public | Email/password login with animated background |
| `/dashboard` | `FranchiseDashboard` | franchise | KPI overview — sales, inventory, alerts |
| `/sales` | `SalesPage` | franchise | POS — barcode/manual entry, cart, discounts, payment, receipts |
| `/inventory` | `InventoryPage` | any | Inventory browser — search, filter, barcode printing |
| `/sales-history` | `SalesHistoryPage` | any | Past sales with filtering, date range, export |
| `/customers` | `CustomersPage` | any | Customer list with loyalty points and transaction history |
| `/forecast` | `ForecastPage` | any | AI-powered sales forecast via Flask + Prophet |
| `/order-stock` | `OrderStockPage` | franchise | Request stock from admin warehouse |
| `/menu` | `RestaurantMenuPage` | any | Restaurant menu CRUD — categories, items, availability |
| `/kitchen` | `KitchenDisplaySystem` | any | KDS — live order tokens, status workflow |
| `/tokens` | `TokenTracker` | any | Token status tracker for restaurant orders |
| `/settings/restaurant` | `RestaurantSettings` | any | Restaurant business account configuration |
| `/admin` | `AdminDashboard` | admin | Admin overview — all franchises, aggregate metrics |
| `/admin/franchises` | `ManageFranchisesPage` | admin | Create, edit, deactivate franchise accounts |
| `/admin/franchise/:id` | `FranchiseDetailPage` | admin | Drill into one franchise — sales, inventory, orders |
| `/admin/reports` | `FinancialReportsPage` | admin | Financial reports across all franchises |
| `/admin/inventory` | `AdminInventoryPage` | admin | Warehouse inventory management |
| `/admin/stock-orders` | `StockOrdersPage` | admin | Approve/reject stock requests from franchises |
| `/add-items` | `AddItemsPage` | admin | Add items to admin warehouse (`franchise_id = null`) |
| `/analytics` | `Dashboard` | admin | Legacy admin analytics view |

---

## Database Schema

All tables use Row-Level Security (RLS). All primary keys are `UUID` with `gen_random_uuid()`.

### `profiles`
One row per user. Linked to `auth.users`. Stores the app-level role (`admin` or `franchise`).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | FK → `auth.users(id)`, CASCADE DELETE |
| `role` | TEXT | `'admin'` or `'franchise'`. DEFAULT `'franchise'` |
| `full_name` | TEXT | NOT NULL |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `default_business_account_id` | UUID | Optional FK → `business_accounts(id)` |

### `franchises`
Each franchise unit. Linked to the profile of its owner. Admin-created.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT | NOT NULL |
| `region` | TEXT | NOT NULL |
| `state` | TEXT | NOT NULL. Indian state name |
| `owner_id` | UUID | FK → `profiles(id)` |
| `created_by` | UUID | FK → `profiles(id)` — admin who created it |
| `is_active` | BOOLEAN | DEFAULT TRUE |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() |
| `business_account_id` | UUID | Optional FK → `business_accounts(id)` |

### `inventory`
All products. `franchise_id = NULL` = warehouse/admin stock. `franchise_id` set = that franchise's own stock.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `sku` | TEXT | NOT NULL. Unique per (sku, franchise_id) |
| `barcode` | TEXT | Optional |
| `item_name` | TEXT | NOT NULL |
| `category` | TEXT | |
| `price` | NUMERIC(12,2) | Unit selling price |
| `quantity` | INTEGER | Current stock count |
| `description` | TEXT | Optional |
| `franchise_id` | UUID | FK → `franchises(id)`. NULL = warehouse |

### `sales`
Every completed sale transaction.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `customer_name` | TEXT | NOT NULL. Denormalized |
| `total` | NUMERIC(12,2) | Grand total after discount + tax |
| `subtotal` | NUMERIC(12,2) | Pre-discount, pre-tax sum |
| `discount_total` | NUMERIC(12,2) | DEFAULT 0 |
| `tax_rate` | NUMERIC(5,2) | DEFAULT 0 |
| `payment_method` | TEXT | `'cash'`, `'upi'`, `'card'`, `'split'` |
| `payment_details` | JSONB | Split breakdown e.g. `{"cash":200,"upi":150}` |
| `date` | TIMESTAMPTZ | DEFAULT NOW() |
| `franchise_id` | UUID | FK → `franchises(id)` |
| `points_earned` | INTEGER | `floor(total/100)` |
| `points_used` | INTEGER | Points redeemed in this sale |

### `customers`
Identified by phone number. Accumulate loyalty points.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT | |
| `phone` | TEXT | UNIQUE. Primary lookup key |
| `email` | TEXT | Optional |
| `points_balance` | INTEGER | DEFAULT 0. 1 point per ₹100 spent |

### `business_accounts`
Multi-tenancy core. Each business (shop, franchise, restaurant) is one row.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `owner_id` | UUID | FK → `profiles(id)` |
| `business_name` | TEXT | NOT NULL |
| `business_type` | TEXT | `'standalone_shop'` \| `'franchise_admin'` \| `'franchise_unit'` |
| `settings` | JSONB | Optional freeform config (feature flags, preferences) |
| `is_active` | BOOLEAN | DEFAULT TRUE |

### Other Tables

- **`sale_items`** — Line items per sale (sku, item_name, quantity, price, discount)
- **`stock_orders`** — Franchise requests for warehouse stock (`pending` → `approved` / `rejected`)
- **`stock_order_items`** — Line items within a stock order
- **`active_account_sessions`** — Tracks which business account is active per user (1 row per user)
- **`permissions`** — RBAC for business accounts (`owner`, `manager`, `operator`, `viewer`)
- **`order_tokens`** — Restaurant order tokens; daily sequential numbering
- **`token_status_history`** — Audit log of every token status transition
- **`restaurant_menu`** — Menu items with categories and availability flags

---

## Context Architecture

### `AuthContext` (`src/context/AuthContext.tsx`)
Global authentication and multi-tenancy state. Wraps the entire app. Handles Supabase auth events, profile loading, and business account switching.

**Key state:** `user`, `profile`, `franchise`, `activeBusinessAccount`, `businessAccounts`, `isLoading`

**Key functions:**
- `signIn(email, password)` — wraps `supabase.auth.signInWithPassword()`
- `signOut()` — clears all state, redirects to `/login`
- `switchBusinessAccount(accountId)` — updates `active_account_sessions` and triggers `InventoryContext` reload
- `createFranchiseUser(...)` — admin action: creates auth user + profile + franchise row
- `getAllFranchises()` — admin only

**Initialization flow:**
1. `supabase.auth.getSession()` — checks localStorage for existing JWT
2. If session found: `setUser()` → `fetchProfile(userId)` → `fetchFranchise()` → `fetchBusinessAccounts()` → `getActiveBusinessAccountFromSession()`
3. Subscribes to `onAuthStateChange` for `SIGNED_IN` / `SIGNED_OUT` events

### `InventoryContext` (`src/context/InventoryContext.tsx`)
All transactional data — inventory, sales history, customers, stock orders. Reloads whenever `activeBusinessAccount` changes.

**Key state:** `inventory`, `salesHistory`, `customers`, `stockOrders`, `isLoading`

**Key functions:**
- `recordSale(items, customerInfo, payment)` — main sale transaction: inserts sale → inserts sale_items → updates inventory quantities → upserts customer → awards points → creates order token if restaurant
- `approveStockOrder(orderId)` — transfers rows from warehouse to franchise by updating `franchise_id`
- `getInventoryBySku(sku)` — sync lookup; prefers franchise-specific row over warehouse row
- `getLowStockItems(threshold?)` — items where `quantity < threshold` (default 20)
- `refreshData()` — re-fetches all four data collections

---

## Services

### `tokenService` (`src/services/tokenService.ts`)
Wraps all Supabase RPC calls for restaurant order token management. Used by `KitchenDisplaySystem` and `SalesPage`.

Functions: `createOrderToken`, `updateTokenStatus`, `getActiveTokens`, `getReadyUnpaidTokens`, `getTokenHistory`

### `menuService` (`src/services/menuService.ts`)
CRUD for restaurant menu items. Reads use RPC for category grouping.

Functions: `getRestaurantMenu`, `getMenuCategories`, `createMenuItem`, `updateMenuItem`, `deleteMenuItem`

### `forecastService` (`src/services/forecastService.ts`)
POSTs sales history to Flask/Prophet backend at `VITE_FORECAST_API_URL`. Falls back to `getLinearFallback()` on error.

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Required
VITE_SUPABASE_URL=https://xyz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...

# Optional — app works without these
VITE_FORECAST_API_URL=http://localhost:5000
VITE_RAZORPAY_KEY_ID=rzp_test_...
```

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL. Found in Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Public anon key. RLS enforces all security |
| `VITE_FORECAST_API_URL` | ❌ | Flask backend URL. ForecastPage falls back to linear trend if absent |
| `VITE_RAZORPAY_KEY_ID` | ❌ | Razorpay publishable key. Use test key in development |

---

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/your-org/mercanta.git
cd mercanta

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start the development server
npm run dev
# App runs at http://localhost:3000

# 5. Build for production
npm run build
```

### Optional: Forecasting Backend

```bash
cd forecast-server
pip install flask prophet pandas
python app.py
# Server runs at http://localhost:5000
```

### Database Setup

Run the migration SQL files in your Supabase project (SQL Editor). Ensure RLS is enabled on all tables and that the policies described in the schema section are applied. Promote your first admin user by manually setting `role = 'admin'` in the `profiles` table after signup.

---

## Role Overview

| Role | Access |
|---|---|
| `admin` | Full access to all franchises, warehouse inventory, financial reports, and stock order approvals |
| `franchise` | Own inventory, sales, customers, stock requests, and restaurant features scoped to their business account |

Route protection is handled by the `ProtectedRoute` component, which reads `profile.role` from `AuthContext`.