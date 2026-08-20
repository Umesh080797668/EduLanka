# EduLanka SaaS Platform — Phased Architecture & Roadmap Blueprint

> **Revision note:** This blueprint has been updated to reflect changes made against the original design: (1) the database moved from schema-per-tenant to a single shared Supabase schema with `tenant_id` + Row-Level Security (see §4a); (2) pricing moved from a flat Free/Pro monthly fee to a per-active-student billing model, then revised again to a hybrid model combining a fixed Base Platform Fee with a Per-Active-Student Fee and explicit hard resource quotas (see §7); (3) the portal/role list was corrected to include all 8 portal types — Student, Parent, Teacher, School Admin, Zonal Office, **Provincial Office**, MoE, and System Admin — the Provincial Office Portal was previously missing from §2 and §5 despite the Provincial Education Dept already appearing in the org hierarchy (§1); and (4) **Disaster Mode was clarified and disambiguated from System Admin's platform-maintenance notices** — Disaster Mode is specifically the natural-disaster / sudden-school-closure emergency feature (floods, cyclones, landslides, MoE-declared closures), never platform downtime — and a natural-disaster feature thread was added phase-by-phase from Phase 2 through Phase 6 (closure taxonomy → offline readiness pack → grounded disaster FAQ → predictive closure alerts → national coordination dashboard). Sections below are marked "Revised" where they diverge from the original spec.

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

Every frontend surface — Next.js web dashboards (Student, Parent, Teacher, School Admin, Zonal Office, Provincial Office, MoE, and System Admin portals — all 8 portal types) and the Flutter mobile app — must ship with a built-in tutorial/walkthrough system covering every feature available to that role at that point in the rollout. This is not a Phase 6 polish item; it is delivered incrementally alongside each phase, so a feature never ships without its accompanying tutorial.

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
| **Phase 3 — Content & Mobile** | Flutter app, offline sync, video/resource hub, Paper Hub, Prisma ORM (Super Admin Analytics) | Can students/teachers use this without constant connectivity? |
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
- **Disaster Mode** *(natural-disaster / sudden-closure emergency communication — floods, cyclones, landslides, or other MoE-declared closures; explicitly **not** a platform-maintenance feature)*: Principal/Admin-triggered Twilio SMS blast to all parents. The trigger record captures a **closure reason taxonomy** (Flood, Cyclone, Landslide, Civil/Public Health, Other) and an **expected closure duration**, and forces offline-sync posture in preparation for the Phase 3 mobile app. This taxonomy is stored specifically so Phase 5's Disaster Impact Prediction and Phase 6's National Disaster Coordination Dashboard have real historical data to build on.
- **System Maintenance Notices** *(platform downtime/upgrade announcements — deliberately separate from Disaster Mode, so a school outage message can never be confused with an actual emergency closure alert)*: System Admin-triggered, platform-wide banner/notice broadcast to all tenants ahead of scheduled maintenance or during an incident.
- **System Admin:** Global SMS quota monitoring, WebSocket gateway observability, and managing System Maintenance Notices above.
- **Tutorials added** for chat (how to message/moderate), notice scoping, and — critically — a dedicated Disaster Mode walkthrough for Admins/Principals ("what happens when I trigger this, and how to pick the right closure reason") and a parent-facing explainer of what a Disaster Mode SMS means.

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
- **Offline Disaster-Readiness Pack**: when a school's Phase 2 Disaster Mode is active, the Flutter app auto-caches, fully offline: emergency contacts, nearest shelter/relocation info, and the closure reason/expected duration set by the Admin — plus the student's last 7 days of homework/resources, so learning continuity doesn't stop just because connectivity does. This is the concrete natural-disaster payoff of the Phase 2 groundwork, not a generic offline mode.
- Prisma ORM Pipeline: Deployed specifically as a background microservice for Super Admin aggregation queries, maintaining strict separation from core RLS transactional paths.
- **System Admin:** Global CDN (Cloudinary) storage monitoring, managing mobile app release syncs, integrating global Prisma aggregations, and uploading national past papers to the central Paper Hub.
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
- **Disaster FAQ Assistant** (grounded RAG use case): while a school's Disaster Mode is active, the Academic Assistant is additionally scoped to answer parent/student questions strictly from official MoE/Zonal closure circulars indexed for that event — a factual, rumor-resistant information channel during an actual emergency, still refusing to answer anything outside that grounded circular context.
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
- **Disaster Impact Prediction**: correlates external weather/flood data (Department of Meteorology / Disaster Management Centre feeds) with the Phase 2 closure-reason history and attendance drop patterns to proactively flag schools likely to need a closure — an early alert to School Admins and Zonal Offices *before* conditions force a reactive Disaster Mode trigger, not just after.
- Teacher Performance Analytics & Behaviour Analytics, and Parent Engagement Score.
- **System Admin:** Auditing predictive model accuracy, tuning baseline risk-score thresholds, and monitoring ML compute infrastructure.
- **Tutorials for interpreting predictive data**: teachers get a walkthrough on reading risk scores and intervention alerts responsibly (what the score means, what it doesn't mean); admins get one for Teacher Performance Analytics.

**Why this phase, not earlier:** This is the phase most dependent on prior phases actually being used — models trained on thin or synthetic data produce unreliable, potentially harmful predictions (e.g., wrongly flagging a student as high-risk). Sequencing it after a real data collection period is a deliberate risk-reduction choice, not a nice-to-have.

**Tech introduced:** Scikit-learn, XGBoost, ML serving infrastructure alongside the FastAPI AI engine, external weather/disaster-data API integration (Dept. of Meteorology / Disaster Management Centre) for Disaster Impact Prediction.

---

## Phase 6 — Scale & Optimization (Timetabling, Marketplace, Ministry Analytics)

**Goal:** Move from single/multi-school usage to genuine national scale with zonal/provincial/MoE-level reporting and the algorithmic features that need a large, stable user base to be worth the engineering cost.

**Scope:**
- Smart Timetable Generator: Google OR-Tools constraint-satisfaction solver (teacher availability, lab capacity, daily period caps, subject spacing). Prototyped carefully — timetabling is a common ed-tech trust failure point, so pilot with one school before rollout.
- National Resource Marketplace: expands the internal Resource Hub into a nationwide teacher-to-teacher sharing platform (lesson plans, slides, worksheets), enabling network effects once enough schools are onboard.
- Ministry Data Warehouse: nightly ETL from supabase into ClickHouse (OLAP) for Provincial/Zonal/MoE hierarchical dashboards (Province ➔ District ➔ Zone ➔ School ➔ Grade ➔ Subject).
- Interactive Digital Report Cards and gamification badges (upgrade from Phase 1's static PDFs).
- **Zonal Office Portal:** Audit workflows for local schools within a specific zone, zone-level analytics reporting.
- **Provincial Office Portal:** Province-level dashboard rolling up its constituent zones (Province ➔ Zone ➔ School), provincial policy monitoring, and cross-zone comparative analytics — sits between Zonal and MoE in the reporting hierarchy.
- **MoE Portal:** Universal emergency notices, national analytics review, country-wide policy monitoring.
- **National Disaster Coordination Dashboard** (MoE/Provincial/Zonal): a real-time national map of every school currently in Disaster Mode, aggregated by the Phase 2 closure-reason taxonomy and cross-referenced with Phase 5's predictive alerts, so Provincial/Zonal offices and the MoE see both active closures and at-risk schools in one view. Integrates with the National Disaster Management Centre (NDMC) for coordinated response and resource allocation — the culmination of the natural-disaster feature thread started in Phase 2.
- **System Admin (Platform Owner):** Handoff of hierarchical dashboards to MoE; focuses on national-scale ClickHouse (OLAP) performance scaling and infrastructure reliability.
- **Full tutorial coverage completed** across every role including the new Zonal/Provincial/MoE hierarchical dashboards, Smart Timetable Generator (with a dedicated "how constraints work" explainer, given how easily timetabling tools lose admin trust), and the National Resource Marketplace publishing flow.

**Tech introduced:** Google OR-Tools, ClickHouse, Prometheus/Grafana/OpenTelemetry/Sentry for national-scale observability, National Disaster Management Centre (NDMC) API integration.

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
| **Provincial Office Portal** | *(not active until Ph.6)* | Province-level roll-up of zonal dashboards (District ➔ Zone aggregation), provincial policy monitoring, cross-zone comparative analytics (Ph.6). |
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

## 7. Pricing Architecture — Revised: Hybrid Base Fee + Per-Active-Student (Replaces Flat Per-Student Model)

**This replaces the previous flat per-student-only model** (a straight LKR/student rate with an awkward "minimum monthly spend" bolted on to protect revenue on small schools). That model had two problems in practice: (1) the minimum-spend floor created an ugly overlap where a small Starter-tier school effectively paid the minimum regardless of actual student count, making the jump from Community's cap feel like an arbitrary penalty rather than a proportional step; and (2) a pure per-student rate doesn't separately account for the fixed infrastructure cost of onboarding a school at all (shared schema overhead, baseline CDN, teacher/admin usage of ML analytics) versus the marginal cost of each additional student row.

**Guiding rule: revenue is derived only from active student count for the variable component, but every paid tier now also carries a small fixed institutional fee.** Teachers, parents, and admin/staff accounts are still never billed and never capped — a school is never discouraged from adding staff. A student is billed as **Active** when `is_active = true` on `public.students` (same definition as before).

### 7a. The Two-Part Fee

1. **Base Platform Fee (fixed, monthly).** A flat subscription by tier. Subsidizes fixed infrastructure that doesn't scale linearly with students — shared-schema maintenance, WebSocket infrastructure, baseline CDN — and covers unbilled teacher/admin usage of the Early Warning System and ML analytics. Sets a clear "software license" entry price for the school as an institution, separate from student capacity.
2. **Per-Active-Student Fee (variable, monthly).** Scales proportionally with billable database rows. Because the Base Fee now covers fixed costs, the per-student rate itself can be set lower than under the old flat model, while remaining competitive for large 1AB/National schools and accessible to small Type 3 schools.
3. **Hard resource quotas replace the old vague "fair-use" language.** Storage (Cloudinary) and AI compute (Qwen RAG token budget) are now explicit per-tier GB/token allowances rather than "fair use" — once a tenant hits its quota, uploads pause (storage) or the AI assistant pauses until next month / an add-on is purchased (AI tokens). This removes the open-ended cost exposure "fair-use unlimited" carried for a bootstrapped SaaS.

### 7b. Tiers

| Tier | Base Platform Fee (Monthly) | Active Student Fee | Hard Resource Quotas & Caps | What It Unlocks | Phase |
|---|---|---|---|---|---|
| **Community** (Free) | LKR 0 | LKR 0 | Hard cap of 75 active students (lowered from 100 to align with paid tiers); 500 MB shared storage | Enrollment, class assignment, grade entry, static PDF report cards, in-app/web notices only (no SMS) | 1 |
| **Starter** | LKR 1,500 | LKR 20 / student | Uncapped students; 2 GB storage; 3 Twilio SMS/student/month included | Everything in Community, plus: full real-time chat (class groups, DMs), targeted notice scoping, Disaster Mode, offline mobile sync (7-day retention), embedded video links | 2 / 3 (partial) |
| **Growth** | LKR 3,000 | LKR 40 / student | Uncapped students; 15 GB storage; 50,000 AI tokens/student/month | Everything in Starter, plus: unlimited offline Flutter SQLite sync, direct video hosting/streaming with encrypted downloads, Paper Hub, AI Academic Assistant (Qwen RAG tutoring) | 3 / 4 |
| **Institutional** | LKR 5,000 | LKR 60 / student | Uncapped students; 50 GB storage; 100,000 AI tokens/student/month | Everything in Growth, plus: Early Warning System, Exam Prediction, Teacher Performance Analytics, Smart Timetable Generator, publishing to the National Resource Marketplace, Zonal/Provincial/MoE hierarchical reporting where applicable | 5 / 6 |

**Example:** An 80-student school on Starter pays `LKR 1,500 + (80 × LKR 20) = LKR 3,100/month`. The cost is a direct, legible function of the school's size instead of the old flat-rate-plus-minimum-spend penalty.

**Volume discount (applies to the *Active Student Fee* component only, on Starter, Growth, Institutional — the Base Platform Fee is never discounted):**

| Active Students | Discount off listed per-student rate |
|---|---|
| 1 – 250 | 0% (listed rate) |
| 251 – 1,000 | 10% |
| 1,001 – 3,000 | 20% |
| 3,000+ | Custom quote (zonal/provincial/national-scale deployments negotiate directly) |

**SMS is metered separately, on top of the tier price.** Twilio cost isn't proportional to student count the way seat-based features are — a quiet school and a school that blasts weekly Disaster Mode alerts consume very different SMS volume for the same student count. Each paid tier includes a small monthly SMS bundle per student (see table above); usage beyond the bundle is billed at cost-plus-margin per message, so heavy SMS use doesn't get cross-subsidized by light-SMS schools on the same tier.

**Why hybrid instead of pure per-student:** it ties EduLanka's revenue to *both* of the platform's real cost drivers — a fixed per-tenant infrastructure/support cost (Base Fee) and the marginal cost of active student rows and their associated data (marks, attendance, chat history, offline sync payloads, AI tokens — Active Student Fee). A small rural Type 3 school and a large Colombo 1AB national school both pay proportionally to their actual footprint and value received, and the awkward Community→Starter minimum-spend cliff is gone.

### 7c. Billing Mechanics (Implementation Note)

- **Active student count is cheap to compute.** Under the shared-schema model (§4a), it's a single query: `SELECT tenant_id, count(*) FROM public.students WHERE is_active = true GROUP BY tenant_id` — one pass across all tenants instead of N per-schema round-trips.
- **The nightly billing job runs as a `BullMQ` cron job inside the NestJS API** (decided over a Supabase Edge Function — see rationale below). It runs the aggregate query above, joins against `public.tenants.plan` and the redesigned `public.plans` table (base fee + per-student rate + quotas, replacing the old flat `price_lkr`), cross-references Twilio API usage for metered SMS overage, and writes the computed monthly charge to a new `public.billing_snapshots` table for invoicing.
  - **Why NestJS/BullMQ over an Edge Function:** billing isn't just a database aggregation — the final invoice requires joining the student count against `public.plans`, cross-referencing the external Twilio API for metered SMS costs, and eventually pushing the payload to a local Sri Lankan payment gateway. NestJS is better equipped than a lightweight Edge Function for that external API orchestration, delayed retries, and failure states. It also integrates natively with the Phase 6 observability stack (Prometheus, Grafana, OpenTelemetry, Sentry), giving visibility into failed billing jobs and dead-letter queues that Edge Function timeouts are harder to trace in a multi-tenant invoicing pipeline.
- **The Community-tier 75-student cap needs a real enforcement trigger** — this is the same gap flagged in §4a. It should be rewritten as a `BEFORE INSERT` trigger on `public.students` that counts `WHERE tenant_id = NEW.tenant_id AND is_active = true` against the tenant's plan cap (pulled from the redesigned `public.plans`), instead of the old `TG_TABLE_SCHEMA`-based version that no longer applies.
- **`public.plans` needs new columns**: `base_fee_lkr`, `price_per_student_lkr`, `student_cap` (nullable = uncapped), `storage_quota_gb`, `ai_token_quota_per_student` — replacing the old single `price_lkr` + `max_students` pair — plus the volume-discount breakpoints (either as columns or a small `public.plan_volume_discounts` lookup table).
- **Open question (unresolved):** whether to automate suspension of tenant access on a failed/unpaid invoice, or leave a grace period where admins retain data access while student accounts are temporarily locked out.

## 8. Technology Stack Specifications (by Phase)

- **Phase 1:** Next.js 16+ (App Router, Turbopack, RSC, Tailwind CSS), NestJS REST APIs, Supabase (shared schema, `tenant_id` + RLS — revised from schema-per-tenant in Sprint 7, see §4a), Redis (sessions).
- **Phase 2:** NestJS WebSockets (chat gateway), Twilio Programmable Messaging API (alphanumeric sender IDs, UTF-8), Redis (WebSocket state, SMS queues).
- **Phase 3:** Flutter (Dart), SQLite (sqflite) for offline storage, Prisma ORM (for server-side Super Admin microservices), Cloudinary (HLS video transcoding, encrypted offline downloads).
- **Phase 4:** Python (FastAPI) AI engine, Meilisearch, dedicated Vector Database (Pinecone / Qdrant / Milvus), Qwen LLM.
- **Phase 5:** Scikit-learn / XGBoost for Early Warning and Exam Prediction models, served alongside the FastAPI AI engine; external weather/disaster-data API (Dept. of Meteorology / Disaster Management Centre) for Disaster Impact Prediction.
- **Phase 6:** Google OR-Tools (Smart Timetable Generator), ClickHouse (Ministry Data Warehouse / OLAP), Prometheus, Grafana, OpenTelemetry, Sentry (national-scale observability), National Disaster Management Centre (NDMC) API integration for the National Disaster Coordination Dashboard.
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