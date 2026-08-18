# EduLanka SaaS Platform — Phased Architecture & Roadmap Blueprint

> **Revision note:** This blueprint has been updated to reflect two changes made against the original design: (1) the database moved from schema-per-tenant to a single shared Supabase schema with `tenant_id` + Row-Level Security (see §4a), and (2) pricing moved from a flat Free/Pro monthly fee to a per-active-student billing model across four tiers (see §7). Sections below are marked "Revised" where they diverge from the original spec.

## 1. System Vision & Sri Lankan Educational Taxonomy

EduLanka is a national-scale, multi-tenant educational SaaS ecosystem engineered specifically for Sri Lanka. It models the Sri Lankan educational grade structure (Grades 1–13) across localized school management, an offline-first Flutter mobile application, an automated Twilio SMS gateway system, and a federated content library.

The long-term vision includes an **AI & Predictive Analytics Engine** — a Qwen-powered Academic Assistant, Early Warning Systems for at-risk students, Smart Timetable generation, and automated NLP-driven insights. This blueprint sequences that vision into buildable phases rather than a single monolithic release.

```text
                            [ Ministry of Education (MoE) ]
                                          │
                  ┌───────────────────────┴───────────────────────┐
       [ Provincial Education Dept (9) ]              [ National Schools (1AB) ]
                  │
       [ Zonal Education Offices (100+) ]
                  │
   ┌──────────────┼──────────────┬──────────────┐
[1AB / 1C]     [Type 2]       [Type 3]     [Private / Semi-Gov]
(A/L Streams) (Up to O/L)    (Primary/Grade 8)  (Approved Private)
```

## 2. Cross-Cutting Requirement: In-App Tutorials for Every Frontend

Every frontend surface — Next.js web dashboards (Student, Parent, Teacher, School Admin, Zonal Office, MoE, and System Admin portals) and the Flutter mobile app — must ship with a built-in tutorial/walkthrough system covering every feature available to that role at that point in the rollout. This is not a Phase 6 polish item; it is delivered incrementally alongside each phase, so a feature never ships without its accompanying tutorial.

**Design principles:**
- **Role-scoped, not generic.** A Student never sees the Teacher's grading tutorial; a Parent never sees Admin SMS-campaign steps. Each role's onboarding only covers what that role can actually do.
- **Feature-scoped, incremental.** When a phase introduces a new feature (e.g., Disaster Mode in Phase 2, the AI Assistant in Phase 4), that feature ships with its own short walkthrough — tutorials grow with the platform instead of being retrofitted at the end.
- **Two tutorial modes, available everywhere:**
  1. **First-run guided tour** — an interactive, step-by-step overlay shown the first time a user reaches a screen (spotlight/coach-mark style: highlight the element, explain it, "Next").
  2. **On-demand help** — a persistent "?" / help icon on every screen that replays that screen's tour or opens a short contextual explainer (text + optional screenshot/short video) at any time, not just first run.
- **Offline-aware (mobile).** Tutorial content in the Flutter app is bundled locally (not fetched live), so it works identically in Disaster Mode / offline-sync conditions.
- **Localization-ready.** The entire platform leverages `next-intl` for full-system support of Sinhala, Tamil, and English. Tutorial copy is stored as translatable content to match the active locale from the start.
- **Low-friction, skippable.** Every guided tour is dismissible and never blocks the user from using the feature; "Skip" and "Don't show again" are always available.
- **Admin visibility.** School Admins can see (aggregate, non-invasive) completion stats for onboarding tours — e.g., "60% of new teachers haven't completed the gradebook tutorial" — to know where extra training/support is needed.

**Implementation approach:**
- **Web (Next.js):** a lightweight coach-mark/tour library (e.g., driver.js, Shepherd.js, or react-joyride) driving spotlighted walkthroughs, plus a help-content panel sourced from a central tutorial-content store.
- **Mobile (Flutter):** an equivalent in-app walkthrough package (e.g., tutorial_coach_mark or a custom overlay) with tutorial assets bundled at build time and updated via app releases (or a lightweight content-sync job when online).
- **Shared content model:** tutorials are defined as structured data (screen ID → ordered steps → element target → copy → optional media) stored centrally (editable exclusively by `SUPER_ADMIN` users) and rendered by both frontends, so tutorial content is authored once and consumed by web and mobile alike, and stays in sync with which features are actually live for a given tenant's plan (Community / Starter / Growth / Institutional — see §7) and phase rollout.

## 3. Why Phase This Project

The full vision spans roughly six independently hard products: a multi-tenant school ERP, a real-time chat platform, an offline-sync mobile app, a RAG-based AI assistant, an ML early-warning system, and a constraint-solver timetabling engine. Building all six to production quality at once is a multi-person, multi-year effort. The phasing below picks a defensible wedge, proves it with real schools, and layers in AI/ML capability once there's real usage data to justify it — the Early Warning System and Exam Prediction models specifically need a season or more of historical attendance/grades/homework data before they can be trained credibly.

## 4. Phase Roadmap Overview

| Phase | Focus | Core Question It Answers |
|---|---|---|
| **Phase 1 — Foundation** | Core school management, auth, tenant model, static report cards | Can a single school run its daily admin on this? |
| **Phase 2 — Communication** | Real-time chat, notices, Twilio SMS, Disaster Mode | Can the school communicate with parents reliably, even offline? |
| **Phase 3 — Content & Mobile** | Flutter app, offline sync, video/resource hub, Paper Hub | Can students/teachers use this without constant connectivity? |
| **Phase 4 — Intelligence Foundations** | Meilisearch, Vector DB, Qwen Academic Assistant (RAG) | Can students get grounded, non-hallucinated AI tutoring? |
| **Phase 5 — Predictive Layer** | Early Warning System, Exam Prediction, Smart Recommendations | Now that we have a year of real data, can we predict outcomes? |
| **Phase 6 — Scale & Optimization** | Smart Timetabling, National Resource Marketplace, Ministry analytics | Can this run nationally across zones/provinces with MoE-level reporting? |

---

## Phase 1 — Foundation (Core School Management)

**Goal:** A single-tenant-capable core platform a school could run daily operations on, with the multi-tenant data model in place from day one (even if only one tenant exists at launch).

**Scope:**
- Multi-tenant data model: **single shared Postgres schema on Supabase**, every tenant-scoped table carrying a `tenant_id` column, Row-Level Security policies keyed off the `tenantId` claim in the JWT, tenant provisioning, role-based access (Student, Parent, Teacher, School Admin). *(Revised — see §4a. Originally spec'd as schema-per-tenant; collapsed to a shared schema in Sprint 7 for cost and operability reasons.)*
- Student/Parent/Teacher portals: enrollment, class assignment, grade entry, static PDF report cards.
- School Admin: account management, basic policy enforcement.
- Auth & API Gateway (Nginx/Kong) — rate limiting, auth routing established early so later services plug in cleanly.
- **System Admin:** Manual provisioning of new school tenants (via backend/CLI, now a single `INSERT` into `public.tenants` — no per-tenant schema DDL to run), managing global `SUPER_ADMIN` tutorial content schemas.
- **First-run guided tour + help system** shipped for all Phase 1 screens across every role (Student, Parent, Teacher, School Admin): enrollment, grade entry, static report cards, account/policy management.

**Explicitly deferred:** chat, SMS, AI, mobile app, timetabling, marketplace.

**Tech introduced:** Next.js 16+ (web dashboards), NestJS (REST APIs), Supabase (shared schema + RLS), Redis (sessions), tour/coach-mark library + central tutorial-content store.

---

## 4a. Multi-Tenancy Model — Revised: Shared Schema, Not Schema-per-Tenant

**This supersedes the original schema-per-tenant design referenced in earlier drafts of this blueprint (and in Phase 1's initial scope).** The platform now runs on a single shared `public` schema in Supabase, with every tenant-scoped table isolated by a `tenant_id` foreign key and Postgres Row-Level Security.

**Why the change:**
- **Cost.** Schema-per-tenant meant every new school added a full duplicated set of tables, indexes, RLS policies, and triggers. On Supabase's connection/compute pricing this scales cost roughly linearly (or worse) with tenant count, well before there's revenue to match — untenable for a bootstrapped, pre-revenue platform.
- **Operability.** Every migration had to be written twice: once as a normal `CREATE TABLE`, once as a `format('...%I...', schema_name)` dynamic-SQL function re-applied to *every existing tenant schema* (see the `apply_sprintN_to_tenant()` pattern in early migrations). This doubled migration-authoring effort and made a single typo in a dynamic-SQL block a platform-wide outage risk instead of a single-table bug.
- **Backup/restore and tooling friction.** Standard Postgres/Supabase tooling (dashboard table browser, PITR, `pg_dump`, connection pooling) assumes a small, stable set of schemas. Hundreds of `tenant_<slug>` schemas fights that tooling instead of working with it.
- **No functional upside for EduLanka's needs.** Schema-per-tenant is usually chosen for very strict compliance isolation or per-tenant custom schema drift — neither applies here. RLS on a shared schema gives the same query-level data isolation guarantee (a `tenant_id` mismatch simply returns zero rows) at a fraction of the operational cost.

**What changed concretely (Sprint 7 / migration `20260813000000_sprint7_single_schema.sql`):**
- All per-tenant tables (`users`, `classes`, `teachers`, `students`, `parents`, `class_teachers`, `student_marks`, `user_tutorials`, `school_policy`, etc.) now live once in `public`, each with a `tenant_id UUID REFERENCES public.tenants(id)`.
- Every table has a `USING (tenant_id::TEXT = current_setting('request.jwt.claim.tenantId', true))` RLS policy, plus a `service_role_all` bypass policy for the NestJS backend's service-role key.
- The `create_tenant_schema()` / `drop_tenant_schema()` RPCs and the various `apply_sprintN_to_tenant()` dynamic-SQL functions are dropped. Provisioning a school is now a single `INSERT INTO public.tenants`; deprovisioning is a status flip (soft-delete) rather than a destructive `DROP SCHEMA ... CASCADE`.
- At the API layer, `SupabaseService.getTenantClient()` no longer opens a connection scoped to a `tenant_<slug>` schema — it returns a proxied service-role client that auto-appends `.eq('tenant_id', ...)` to every `select`/`update`/`delete` call, so existing service code (`classes.service.ts`, `parents.service.ts`, etc.) didn't need a full rewrite.

**Known gaps this reopened (flagging for near-term follow-up, not deferring silently):**
- The free-tier **student cap enforcement was lost in the collapse**. The old `check_tenant_student_limit()` trigger and `apply_sprint4_to_tenant()` cap logic were written against the schema-per-tenant model (`TG_TABLE_SCHEMA`-based) and were not ported to a `public.students` equivalent — there is currently no DB-level guard stopping a Free-tier tenant from exceeding its plan's student allowance. This needs a rewritten trigger scoped to `tenant_id` instead of schema name (see §7a for how this now plugs into the revised pricing model).
- `getTenantClient(tenantId)` is invoked inconsistently across services — most call sites correctly pass the tenant's UUID, but at least one (`TenantService.getStats()`) passes `tenant.slug`, which silently produces a `tenant_id`-filter that never matches and returns zero counts. Worth an audit pass now that the proxy pattern is relied on everywhere.
- Because billing is about to move to active-student-count metering (§7a), the missing cap logic and the `getTenantClient` slug/UUID inconsistency should be fixed together — the same nightly job that counts billable students per tenant is the natural place to also enforce/report cap overages.

---

## Phase 2 — Communication (Chat, Notices, Disaster Mode)

**Goal:** Reliable, scoped communication between school, teachers, and parents — including the Sri Lanka-specific failure mode of sudden school closures.

**Scope:**
- Real-Time Chat Gateway (WebSockets via NestJS): auto-provisioned class groups (e.g., Grade 9-A).
- Targeted notice scoping: Universal (MoE-ready but MoE role deferred to Phase 6), School-Wide, Grade-Level, Class-Specific.
- Twilio SMS integration: alphanumeric sender IDs, UTF-8 Unicode support.
- **Disaster Mode**: Principal/Admin-triggered Twilio SMS blast to all parents; forces offline-sync posture in preparation for the Phase 3 mobile app.
- **System Admin:** Global SMS quota monitoring, WebSocket gateway observability, and broadcasting platform-wide maintenance notices.
- **Tutorials added** for chat (how to message/moderate), notice scoping, and — critically — a dedicated Disaster Mode walkthrough for Admins/Principals ("what happens when I trigger this") and a parent-facing explainer of what a Disaster Mode SMS means.

**Why this phase, not later:** Disaster Mode and SMS are low-AI-dependency, high-local-relevance features that differentiate EduLanka from generic school SaaS immediately — good for early school acquisition before AI capability exists.

**Tech introduced:** WebSocket infrastructure, Twilio Programmable Messaging API, Redis (SMS queues, WebSocket state).

---

## Phase 3 — Content & Mobile (Offline-First Flutter App)

**Goal:** Students and teachers can use EduLanka meaningfully without constant connectivity — critical outside Colombo and during Disaster Mode.

**Scope:**
- Flutter app (Android/iOS) with local SQLite (sqflite): offline attendance, offline homework payloads, local chat caching.
- Media Asset Hub via Cloudinary: HLS adaptive-bitrate video, encrypted offline video downloads to local storage.
- Paper Hub: exam paper PDFs paired with official marking schemes for split-screen practice.
- Sync engine: reconciles offline-completed work when connectivity returns (built directly on the Disaster Mode groundwork from Phase 2).
- **System Admin:** Global CDN (Cloudinary) storage monitoring, managing mobile app release syncs, and uploading national past papers to the central Paper Hub.
- **Mobile-native tutorial system** launched: bundled, offline-capable walkthroughs for the Flutter app covering offline homework, video downloads, and the Paper Hub, so onboarding works even with no connectivity.

**Explicitly deferred:** National Resource Marketplace (school-internal resource sharing only in this phase), AI assistant, gamification badges.

**Tech introduced:** Flutter/Dart, sqflite, Cloudinary asset pipeline, bundled mobile tutorial/coach-mark package.

---

## Phase 4 — Intelligence Foundations (Qwen RAG Academic Assistant)

**Goal:** Ship a grounded, non-hallucinating AI tutor scoped strictly to each school's approved curriculum — the first AI feature, and the one with the clearest immediate value per user.

**Scope:**
- Meilisearch integration for fast lexical filtering (e.g., isolating notes for "Grade 11 Physics").
- Dedicated Vector Database (Pinecone/Qdrant/Milvus) for semantic similarity search over chunked curriculum documents.
- Retriever layer: combines, ranks, and injects retrieved context.
- Qwen LLM integration via Python/FastAPI: answers generated strictly from retrieved context, not open-ended generation.
- **System Admin:** Indexing national curriculum documents into the Vector DB, monitoring RAG pipeline health, and auditing LLM API token costs.
- **Assistant onboarding tutorial**: a short first-run walkthrough teaching students what the Academic Assistant can and can't do (curriculum-grounded only, not general-purpose chat), plus example prompts.

**Query flow:**

```text
[ supabase ] ──► [ Meilisearch ] ──► [ Vector Database ] ──► [ Retriever ] ──► [ Qwen LLM ] ──► [ Answer ]
```

**Why this phase, not earlier:** RAG grounding requires a real corpus of school-approved content, which only exists once Phase 1–3 usage has populated the Resource/Paper Hub. Shipping AI before there's real content risks hallucination or an empty-context assistant.

**Tech introduced:** Python (FastAPI), Meilisearch, Vector DB, Qwen LLM.

---

## Phase 5 — Predictive Layer (Early Warning System & Exam Prediction)

**Goal:** Use the now-available historical data (a full term or year of attendance, homework completion, and assessment marks from Phases 1–4) to predict at-risk students and exam outcomes.

**Scope:**
- Risk scoring pipeline (Scikit-learn/XGBoost): `Attendance ↓ + Homework Completion ↓ + Assessment Marks ↓ = High Risk Score`.
- Teacher-facing intervention alerts (e.g., probability-of-failing notifications).
- Exam Prediction: G.C.E. O/L, A/L, and Grade 5 Scholarship projections from historical term-test trajectories.
- Smart Recommendation Engine: on poor module performance, auto-curates resources from the internal Resource Hub (marketplace-wide recommendations wait for Phase 6).
- Teacher Performance Analytics & Behaviour Analytics, and Parent Engagement Score.
- **System Admin:** Auditing predictive model accuracy, tuning baseline risk-score thresholds, and monitoring ML compute infrastructure.
- **Tutorials for interpreting predictive data**: teachers get a walkthrough on reading risk scores and intervention alerts responsibly (what the score means, what it doesn't mean); admins get one for Teacher Performance Analytics.

**Why this phase, not earlier:** This is the phase most dependent on prior phases actually being used — models trained on thin or synthetic data produce unreliable, potentially harmful predictions (e.g., wrongly flagging a student as high-risk). Sequencing it after a real data collection period is a deliberate risk-reduction choice, not a nice-to-have.

**Tech introduced:** Scikit-learn, XGBoost, ML serving infrastructure alongside the FastAPI AI engine.

---

## Phase 6 — Scale & Optimization (Timetabling, Marketplace, Ministry Analytics)

**Goal:** Move from single/multi-school usage to genuine national scale with zonal/provincial/MoE-level reporting and the algorithmic features that need a large, stable user base to be worth the engineering cost.

**Scope:**
- Smart Timetable Generator: Google OR-Tools constraint-satisfaction solver (teacher availability, lab capacity, daily period caps, subject spacing). Prototyped carefully — timetabling is a common ed-tech trust failure point, so pilot with one school before rollout.
- National Resource Marketplace: expands the internal Resource Hub into a nationwide teacher-to-teacher sharing platform (lesson plans, slides, worksheets), enabling network effects once enough schools are onboard.
- Ministry Data Warehouse: nightly ETL from supabase into ClickHouse (OLAP) for Provincial/Zonal/MoE hierarchical dashboards (Province ➔ District ➔ Zone ➔ School ➔ Grade ➔ Subject).
- Interactive Digital Report Cards and gamification badges (upgrade from Phase 1's static PDFs).
- **Zonal Office Portal:** Audit workflows for local schools within a specific zone, zone-level analytics reporting.
- **MoE Portal:** Universal emergency notices, national analytics review, country-wide policy monitoring.
- **System Admin (Platform Owner):** Handoff of hierarchical dashboards to MoE; focuses on national-scale ClickHouse (OLAP) performance scaling and infrastructure reliability.
- **Full tutorial coverage completed** across every role including the new Zonal/MoE hierarchical dashboard, Smart Timetable Generator (with a dedicated "how constraints work" explainer, given how easily timetabling tools lose admin trust), and the National Resource Marketplace publishing flow.

**Tech introduced:** Google OR-Tools, ClickHouse, Prometheus/Grafana/OpenTelemetry/Sentry for national-scale observability.

---

## 5. Core Functional Modules & AI-Enhanced Access Control (by Phase)

> Every role/module in the table below receives a matching first-run tutorial and on-demand help content the moment its features go live — see Section 2.

| Module / Role | Phase 1–3 Capabilities | Phase 4–6 AI & Advanced Features |
|---|---|---|
| **Student Portal** | Access modules, class chats, offline video downloads, check grades, download papers. | AI Academic Assistant (Qwen RAG, Ph.4). Achievement Badges & Interactive Digital Report Cards (Ph.6). |
| **Parent Portal** | Track attendance, view report cards, receive SMS notices, chat with teachers. | Parent Engagement Score (Ph.5). |
| **Teacher Portal** | Issue announcements, moderate chats, upload videos, track attendance, mark papers. | Early Warning System, Teacher Performance Analytics, Behaviour Analytics (Ph.5). |
| **School Admin** | Manage accounts, broadcast notices, audit chats, run SMS campaigns. | Smart Timetable Generator, School AI Insights (Ph.6). |
| **Zonal Office Portal** | *(not active until Ph.6)* | Zone-level dashboards, local school audits, zone-level analytics (Ph.6). |
| **MoE Portal** | *(not active until Ph.6)* | National aggregate dashboards, universal emergency notices, MoE oversight (Ph.6). |
| **System Admin Portal** | Provision schools, monitor CDN/SMS quotas, upload global tutorials/papers (Ph.1-3). | Manage Vector DB, audit AI models, monitor LLM costs and national scale (Ph.4-6). |
| **Resource Hub** | School-internal repository for blogs, videos, links, exam papers with marking schemes. | National Resource Marketplace (Ph.6). |

## 6. Platform Architecture (Target State — Phase 6)

The diagram below represents the fully realized architecture; earlier phases implement subsets of this stack (see phase sections above for what's active when).

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENT LAYER                                     │
│  Next.js 16+ Web Dashboards                     Flutter App (Android/iOS)       │
│  (React Server Components & Turbopack)          (Local SQLite + Encrypted Media) │
└─────────────────────────┬───────────────────────────────────────┬───────────────┘
                          │                                       │
                          ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                API GATEWAY                                      │
│                (Nginx / Kong Gateway - Rate Limiting & Auth Routing)            │
└──────┬──────────────────────┬──────────────────────┬──────────────────────┬─────┘
       │                      │                      │                      │
       ▼                      ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│ Core School  │       │ Real-Time    │       │ Notice & SMS │       │ AI & ML      │
│  Service     │       │ Chat Gateway │       │ (Twilio API) │       │ Engine (RAG) │
│  (Phase 1)   │       │  (Phase 2)   │       │  (Phase 2)   │       │ (Phase 4–5)  │
└──────┬───────┘       └──────┬───────┘       └──────┬───────┘       └──────┬───────┘
       │                      │                      │                      │
       ▼                      ▼                      ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              STORAGE & AI LAYER                                 │
│                                                                                 │
│ ┌─────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐ │
│ │ Supabase Cluster        │  │ Meilisearch + Vector DB│  │ Media Asset Hub    │ │
│ │ (Shared Schema + RLS)   │  │ (Hybrid RAG Retrieval) │  │ (Cloudinary CDN)   │ │
│ │  (Phase 1, rev. Sprint 7)│  │      (Phase 4)         │  │     (Phase 3)      │ │
│ │      (Phase 1, rev. Sprint 7) │                    │  │                    │ │
│ └────────────┬────────────┘  └───────────┬────────────┘  └────────────────────┘ │
│              │                           │                                      │
│              ▼ (Nightly ETL)             ▼ (Context)                            │
│ ┌─────────────────────────┐  ┌────────────────────────┐                         │
│ │ Ministry Data Warehouse │  │ Qwen LLM Engine        │                         │
│ │ (ClickHouse / OLAP DB)  │  │ (Academic Assistant)   │                         │
│ │      (Phase 6)          │  │      (Phase 4)         │                         │
│ └─────────────────────────┘  └────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 7. Pricing Architecture — Revised: Per-Student Pricing (Replaces Flat Free/Pro)

**This replaces the old flat LKR 0 / LKR 5,000-per-month Free/Pro model.** The old model had two problems in practice: (1) a flat monthly fee doesn't scale with a school's actual size — a 200-student school and a 2,000-student school paid the same LKR 5,000 on Pro, which undercharges large schools and overcharges small ones; and (2) the Free-tier's 250-student cap was never actually enforced at the database level once the schema-per-tenant cap trigger was lost in the Sprint 7 collapse (§4a), so it wasn't a real ceiling.

**Guiding rule: revenue is derived only from active student count.** Teachers, parents, and admin/staff accounts are never billed and never capped — a school is never discouraged from adding staff. What a school pays scales with how many *students* it actually enrolls and keeps active, billed monthly per **Active Student** (a student row with `is_active = true`, mirroring how the old cap trigger counted).

### 7a. Tiers

| Tier | Price | Active Student Cap | What It Unlocks | Phase |
|---|---|---|---|---|
| **Community** (Free) | LKR 0 / student | Up to 100 active students | Enrollment, class assignment, grade entry, static PDF report cards, in-app/web notices only (no SMS), 500 MB shared document storage | 1 |
| **Starter** | LKR 40 / student / month (min. LKR 3,000/mo) | Uncapped | Everything in Community, plus: full real-time chat (class groups, DMs), targeted notice scoping, Disaster Mode + 3 Twilio SMS/student/month included, offline mobile sync (7-day retention), embedded video links, 2 GB storage | 2 / 3 (partial) |
| **Growth** | LKR 75 / student / month (min. LKR 8,000/mo) | Uncapped | Everything in Starter, plus: unlimited offline Flutter SQLite sync, direct video hosting/streaming with encrypted downloads, Paper Hub, fair-use unlimited Cloudinary storage, AI Academic Assistant (Qwen RAG tutoring, fair-use token quota per student) | 3 / 4 |
| **Institutional** | LKR 110 / student / month, volume-negotiated above 1,000 students | Uncapped | Everything in Growth, plus: Early Warning System, Exam Prediction, Teacher Performance Analytics, Smart Timetable Generator, publishing to the National Resource Marketplace, Zonal/MoE hierarchical reporting where applicable | 5 / 6 |

**Volume discount (applies to Starter, Growth, Institutional):**

| Active Students | Discount off listed per-student rate |
|---|---|
| 1 – 250 | 0% (listed rate) |
| 251 – 1,000 | 10% |
| 1,001 – 3,000 | 20% |
| 3,000+ | Custom quote (zonal/national-scale deployments negotiate directly) |

**SMS is metered separately, on top of the tier price.** Twilio cost isn't proportional to student count the way seat-based features are — a quiet school and a school that blasts weekly Disaster Mode alerts consume very different SMS volume for the same student count. Each paid tier includes a small monthly SMS bundle per student (see table above); usage beyond the bundle is billed at cost-plus-margin per message, so heavy SMS use doesn't get cross-subsidized by light-SMS schools on the same tier.

**Why per-student instead of flat-fee:** it directly ties EduLanka's revenue to the platform's actual Supabase/Cloudinary/compute cost driver — active student rows and their associated data (marks, attendance, chat history, offline sync payloads) scale per student, not per school. A small rural Type 3 school and a large Colombo 1AB national school now pay proportionally to their actual footprint and value received, rather than the old flat rate that made Pro a bad deal for small schools and an underpriced deal for large ones.

### 7b. Billing Mechanics (Implementation Note)

- **Active student count is now cheap to compute.** Under the old schema-per-tenant model, metering meant running `SELECT count(*) FROM tenant_<slug>.students` once per tenant schema. Under the shared-schema model (§4a), it's a single query: `SELECT tenant_id, count(*) FROM public.students WHERE is_active = true GROUP BY tenant_id` — one pass across all tenants instead of N per-schema round-trips. This was a direct cost/operability win from the Sprint 7 migration, independent of the pricing redesign.
- **A nightly billing job** (proposed: `BullMQ` cron in the NestJS API, or a Supabase Edge Function) should run this aggregate query, join against `public.tenants.plan` and a redesigned `public.plans` table (per-student rate + student cap replacing the old flat `price_lkr`), and write the computed monthly charge to a new `public.billing_snapshots` table for invoicing.
- **The Community-tier 100-student cap needs a real enforcement trigger again** — this is the same gap flagged in §4a. It should be rewritten as a `BEFORE INSERT` trigger on `public.students` that counts `WHERE tenant_id = NEW.tenant_id AND is_active = true` against the tenant's plan cap (pulled from the redesigned `public.plans`), instead of the old `TG_TABLE_SCHEMA`-based version that no longer applies.
- **`public.plans` needs new columns**: `price_per_student_lkr`, `student_cap` (nullable = uncapped), replacing the old single `price_lkr` + `max_students` pair, plus the volume-discount breakpoints (either as columns or a small `public.plan_volume_discounts` lookup table).

## 8. Technology Stack Specifications (by Phase)

- **Phase 1:** Next.js 16+ (App Router, Turbopack, RSC, Tailwind CSS), NestJS REST APIs, Supabase (shared schema, `tenant_id` + RLS — revised from schema-per-tenant in Sprint 7, see §4a), Redis (sessions).
- **Phase 2:** NestJS WebSockets (chat gateway), Twilio Programmable Messaging API (alphanumeric sender IDs, UTF-8), Redis (WebSocket state, SMS queues).
- **Phase 3:** Flutter (Dart), SQLite (sqflite) for offline storage, Cloudinary (HLS video transcoding, encrypted offline downloads).
- **Phase 4:** Python (FastAPI) AI engine, Meilisearch, dedicated Vector Database (Pinecone / Qdrant / Milvus), Qwen LLM.
- **Phase 5:** Scikit-learn / XGBoost for Early Warning and Exam Prediction models, served alongside the FastAPI AI engine.
- **Phase 6:** Google OR-Tools (Smart Timetable Generator), ClickHouse (Ministry Data Warehouse / OLAP), Prometheus, Grafana, OpenTelemetry, Sentry (national-scale observability).
- **Cross-cutting (all phases):** tour/coach-mark libraries (e.g., driver.js / Shepherd.js / react-joyride for web, tutorial_coach_mark or a custom overlay for Flutter), a central structured tutorial-content store (screen → steps → copy → media, translatable into Sinhala/Tamil/English), and bundled offline tutorial assets for mobile.


### Later Enhancements 
**1. National School Leaderboard & Analytics (Gamification)**
   - **Metrics Engine:** A nightly background worker (`Cron/BullMQ`) that synthesizes daily attendance arrays, assignment completion velocities, and standardized term test curves into a normalized "School Engagement Score" (SES).
   - **Architecture:** Utilizing the ClickHouse OLAP cluster, cross-tenant telemetry is pulled seamlessly without degrading operational database performance. 
   - **UX:** A public or Ministry-level dashboard plotting the Top 50 schools nationally or provincially, granting awards (badges) that render on the School's profile across the mobile and web portals to encourage institutional competitiveness and transparency.

**2. Inter-School Event Grids (Multi-Tenant Hubs)**
   - **Cross-Tenant Collaboration:** Breaking the rigid RLS isolation temporarily via `Event Hubs` where multiple `tenant_id` pools can register participants (now a straightforward RLS policy exception in the shared schema, rather than a cross-schema join).
   - **Use Cases:** Regional sports meets, national debates, and inter-district hackathons. 
   - **Data Flow:** A specialized `public.events` global table that utilizes Foreign Keys tracking the `tenant_id` of the hosting school and JSONB arrays storing the `user_id` mapped identities of participating guest schools, generating universal QR tickets and global push notifications.