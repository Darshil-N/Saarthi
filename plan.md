# NUMM — Build Plan
## BharatOil Demo | 10 Days

---

## PHASE 1 — Foundation
*Days 1–2 | Everything the rest of the project depends on*

### Part 1.1 — Project Setup
- Step 1: Initialize React + Vite + Tailwind + Shadcn
- Step 2: Initialize FastAPI project with folder structure
- Step 3: Set up environment variables for both frontend and backend
- Step 4: Configure CORS, middleware, and health check endpoint

### Part 1.2 — Supabase Setup
- Step 1: Create Supabase project
- Step 2: Run all table creation SQL (12 tables)
- Step 3: Enable pgvector extension
- Step 4: Write and apply RLS policies per role
- Step 5: Create Supabase Storage bucket for bill images

### Part 1.3 — Authentication
- Step 1: Connect Supabase Auth to FastAPI (JWT validation middleware)
- Step 2: Connect Supabase Auth to React (session management)
- Step 3: Build Login page with role-based redirect
- Step 4: Build ProtectedRoute component with role guard

### Part 1.4 — Seed Data
- Step 1: Seed vendors (10 vendors)
- Step 2: Seed warehouse locations (3 warehouses, all aisles and bins)
- Step 3: Seed 50+ materials with intentional duplicates and near-duplicates
- Step 4: Generate and store embeddings for all seeded materials
- Step 5: Seed inventory levels across locations
- Step 6: Seed price history (6 months, multiple vendors per material)
- Step 7: Seed user accounts for all 4 roles

---

## PHASE 2 — Intake Pipeline
*Days 3–4 | How stock enters the system*

### Part 2.1 — OCR Service (Backend)
- Step 1: Integrate Gemini Vision API in FastAPI
- Step 2: Write OCR prompt template and parser
- Step 3: Build bill image upload endpoint (save to Supabase Storage)
- Step 4: Build OCR extraction endpoint returning structured line items
- Step 5: Handle multi-page PDFs and image quality fallbacks

### Part 2.2 — OCR UI (Frontend)
- Step 1: Build drag-and-drop bill upload component
- Step 2: Build processing / loading state
- Step 3: Build OCR results table (editable: qty, price, quality, location)
- Step 4: Build match status badges (Exact / Near-Duplicate / New / Uncertain)
- Step 5: Build "Confirm Receipt" flow and GR creation

### Part 2.3 — Barcode Scanner (Frontend + Backend)
- Step 1: Integrate @zxing/browser webcam scanning
- Step 2: Build scanning overlay UI with live camera feed
- Step 3: Build barcode lookup endpoint (CNMC + legacy code lookup)
- Step 4: Build material pre-fill on successful scan
- Step 5: Build multi-item scan session before confirming GR

### Part 2.4 — Goods Receipt Management
- Step 1: Build GR creation endpoint (header + line items)
- Step 2: Build GR list screen with filters
- Step 3: Build GR detail screen with line item breakdown
- Step 4: Build inventory update on GR confirmation
- Step 5: Build price_history insert on GR confirmation

---

## PHASE 3 — AI Core
*Days 4–5 | The intelligence layer*

### Part 3.1 — Embedding Service
- Step 1: Integrate Gemini text-embedding-004 in FastAPI
- Step 2: Build embedding generation for incoming material descriptions
- Step 3: Build pgvector cosine similarity search
- Step 4: Set similarity thresholds (exact / near-dup / new)

### Part 3.2 — Material Matching Engine
- Step 1: Build matching_service with pgvector top-5 candidate retrieval
- Step 2: Build Gemini scoring prompt for each candidate pair
- Step 3: Build matching_queue insert logic per result
- Step 4: Wire matching as a FastAPI BackgroundTask on every new material intake
- Step 5: Build auto-resolution for high-confidence exact matches

### Part 3.3 — CNMC Generator
- Step 1: Build CNMC generation prompt with category tree
- Step 2: Build CNMC parser and validator (format check)
- Step 3: Build uniqueness check against existing CNMCs
- Step 4: Build collision handler (append suffix if CNMC already exists)
- Step 5: Wire CNMC generation into new material intake flow

### Part 3.4 — Approval Workflow
- Step 1: Build pending approvals list endpoint
- Step 2: Build approve-mapping endpoint (merge quantities, deprecate duplicate)
- Step 3: Build reject-mapping endpoint (proceed as new material)
- Step 4: Build Pending Approvals screen (Entry dashboard)
- Step 5: Build approval confirmation with audit log write

---

## PHASE 4 — Engineering Dashboard
*Day 6 | Find materials, query inventory*

### Part 4.1 — NL→SQL Service
- Step 1: Build NL→SQL Gemini prompt with schema context
- Step 2: Build SQL safety validator (SELECT only, no mutations)
- Step 3: Build safe query executor against Supabase
- Step 4: Build nl_query_log insert on every query
- Step 5: Build error handling for invalid SQL

### Part 4.2 — NL Query UI
- Step 1: Build NL query search bar with example placeholders
- Step 2: Build loading and streaming state
- Step 3: Build results table with material + location columns
- Step 4: Build SQL reveal (collapsible) with explanation
- Step 5: Build query history panel

### Part 4.3 — Material Catalog & Detail
- Step 1: Build material catalog with category filter tree
- Step 2: Build material search (description + CNMC)
- Step 3: Build material detail page (specs, inventory, price history)
- Step 4: Build related/equivalent materials section

### Part 4.4 — Inventory Map
- Step 1: Build warehouse grid layout component
- Step 2: Build bin color coding (stock level status)
- Step 3: Build bin click → show stored materials
- Step 4: Connect to live inventory data

---

## PHASE 5 — Accounts Dashboard
*Day 7 | Price intelligence and financial visibility*

### Part 5.1 — Price Comparison Engine
- Step 1: Build price history aggregation endpoint per material per vendor
- Step 2: Build vendor ranking logic (avg price + quality score)
- Step 3: Build savings calculator (best vendor vs current vendor delta)
- Step 4: Build bulk savings opportunities endpoint

### Part 5.2 — Price Intelligence UI
- Step 1: Build material selector with search
- Step 2: Build vendor comparison table with recommendation badge
- Step 3: Build price trend chart (Recharts line chart, per vendor)
- Step 4: Build savings calculator display
- Step 5: Build "Switch vendor, save ₹X" alert cards

### Part 5.3 — Stock Valuation & Vendor Analysis
- Step 1: Build total inventory value by category endpoint
- Step 2: Build aging inventory endpoint (90/180/365 days no movement)
- Step 3: Build stock valuation screen (pie chart + table)
- Step 4: Build vendor scorecard endpoint (price + quality + volume)
- Step 5: Build vendor analysis screen

---

## PHASE 6 — Admin Dashboard
*Day 8 | Governance, audit, full control*

### Part 6.1 — Material Governance
- Step 1: Build material list with all statuses (pending/approved/deprecated)
- Step 2: Build single material approve/deprecate endpoints
- Step 3: Build bulk approve endpoint
- Step 4: Build material edit endpoint (description, specs, CNMC) with audit
- Step 5: Build material merge endpoint (deprecate + transfer inventory)
- Step 6: Build governance screen UI

### Part 6.2 — Audit Trail
- Step 1: Build audit log query endpoint (paginated, filterable)
- Step 2: Build audit trail screen with filters (actor, action, entity, date)
- Step 3: Build entity-level audit view (history for one material/GR)

### Part 6.3 — Duplicate Detection Overview
- Step 1: Build matching queue stats endpoint
- Step 2: Build duplicate families grouping query
- Step 3: Build duplicate detection screen with bulk review

### Part 6.4 — User Management & System Health
- Step 1: Build user list + create user endpoints
- Step 2: Build user management screen
- Step 3: Build system health stats endpoint (API usage, DB size, error count)
- Step 4: Build system health screen

---

## PHASE 7 — Landing Page & Polish
*Day 9 | First impressions and production readiness*

### Part 7.1 — Landing Page
- Step 1: Build hero section with CNMC animation
- Step 2: Build live stats section (pulls from admin dashboard endpoint)
- Step 3: Build capabilities section (6 feature cards)
- Step 4: Build problem statement section with impact numbers

### Part 7.2 — Polish & Edge Cases
- Step 1: Add loading skeletons to all data-fetching screens
- Step 2: Add empty states to all list screens
- Step 3: Add error boundaries and toast notifications
- Step 4: Mobile responsive pass on all dashboards
- Step 5: Sidebar collapse on small screens

### Part 7.3 — Demo Preparation
- Step 1: Create 3 realistic BharatOil bill images for OCR demo
- Step 2: Pre-seed matching queue with pending duplicates for demo
- Step 3: Rehearse full 3-minute demo narrative end to end
- Step 4: Prepare demo user accounts (one per role, easy passwords)

---

## PHASE 8 — Deployment
*Day 10 | Ship it*

### Part 8.1 — Deploy Frontend
- Step 1: Push React app to GitHub
- Step 2: Connect GitHub repo to Vercel
- Step 3: Set VITE_ environment variables in Vercel dashboard
- Step 4: Deploy and verify all routes work

### Part 8.2 — Deploy Backend
- Step 1: Push FastAPI app to GitHub
- Step 2: Connect repo to Render, set as Python web service
- Step 3: Set environment variables in Render dashboard
- Step 4: Deploy and verify health endpoint + all API routes

### Part 8.3 — Final Checks
- Step 1: Test full OCR intake flow on deployed URLs
- Step 2: Test barcode scanning on deployed frontend
- Step 3: Test NL→SQL on deployed stack end to end
- Step 4: Test all 4 role logins and dashboard access
- Step 5: Verify audit trail capturing all actions
- Step 6: Final demo run-through on production URLs

---

*8 Phases | 31 Parts | 130 Steps*
