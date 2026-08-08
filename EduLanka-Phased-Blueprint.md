# EduLanka SaaS Platform — Phased Architecture & Roadmap Blueprint

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

Every frontend surface — Next.js web dashboards (Student, Parent, Teacher, School Admin, and eventually Zonal/MoE) and the Flutter mobile app — must ship with a built-in tutorial/walkthrough system covering every feature available to that role at that point in the rollout. This is not a Phase 6 polish item; it is delivered incrementally alongside each phase, so a feature never ships without its accompanying tutorial.

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
- **Shared content model:** tutorials are defined as structured data (screen ID → ordered steps → element target → copy → optional media) stored centrally (editable exclusively by `SUPER_ADMIN` users) and rendered by both frontends, so tutorial content is authored once and consumed by web and mobile alike, and stays in sync with which features are actually live for a given tenant's plan (Free vs. Pro) and phase rollout.

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
- Multi-tenant data model: schema-per-tenant supabase, tenant provisioning, role-based access (Student, Parent, Teacher, School Admin).
- Student/Parent/Teacher portals: enrollment, class assignment, grade entry, static PDF report cards.
- School Admin: account management, basic policy enforcement.
- Auth & API Gateway (Nginx/Kong) — rate limiting, auth routing established early so later services plug in cleanly.
- **First-run guided tour + help system** shipped for all Phase 1 screens across every role (Student, Parent, Teacher, School Admin): enrollment, grade entry, static report cards, account/policy management.

**Explicitly deferred:** chat, SMS, AI, mobile app, timetabling, marketplace.

**Tech introduced:** Next.js 16+ (web dashboards), NestJS (REST APIs), supabase, Redis (sessions), tour/coach-mark library + central tutorial-content store.

---

## Phase 2 — Communication (Chat, Notices, Disaster Mode)

**Goal:** Reliable, scoped communication between school, teachers, and parents — including the Sri Lanka-specific failure mode of sudden school closures.

**Scope:**
- Real-Time Chat Gateway (WebSockets via NestJS): auto-provisioned class groups (e.g., Grade 9-A).
- Targeted notice scoping: Universal (MoE-ready but MoE role deferred to Phase 6), School-Wide, Grade-Level, Class-Specific.
- Twilio SMS integration: alphanumeric sender IDs, UTF-8 Unicode support.
- **Disaster Mode**: Principal/Admin-triggered Twilio SMS blast to all parents; forces offline-sync posture in preparation for the Phase 3 mobile app.
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
- Zonal/MoE role: universal emergency notices, 210-day audit workflows, national analytics review.
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
| **Zonal / MoE** | *(not active until Ph.6)* | Hierarchical Dashboard, universal notices, national audits (Ph.6). |
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
│ │ supabase Cluster      │  │ Meilisearch + Vector DB│  │ Media Asset Hub    │ │
│ │ (Schema-per-Tenant DB)  │  │ (Hybrid RAG Retrieval) │  │ (Cloudinary CDN)   │ │
│ │      (Phase 1)          │  │      (Phase 4)         │  │     (Phase 3)      │ │
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

## 7. Pricing Architecture & Feature Matrix (Free vs. Pro, Target State)

This is the eventual Free/Pro matrix once all phases ship. In practice, Pro-tier gating only becomes meaningful starting Phase 4 (AI features); Phases 1–3 features can ship as a single tier while the platform is proving itself with early-adopter schools.

| Feature Domain | Free Package (LKR 0 / month) | Pro Package (LKR 5,000 / month) | Phase Introduced |
|---|---|---|---|
| Student Capacity | Up to 250 Active Students | Unlimited Students | 1 |
| Report Cards & Badges | Static PDFs | Interactive Digital Reports & Gamification Badges | 1 / 6 |
| Real-Time Chat | Class Section Groups Only | Full Chat Engine (Groups, DMs, File/Voice Attachments) | 2 |
| Notices & Disaster Mode | In-App/Web notices only | Universal Scoping + Disaster Mode + 500 Twilio SMS/mo | 2 |
| Offline Mobile Sync | Basic (Max 3 days retention) | Full Offline Sync (Unlimited Flutter SQLite storage) | 3 |
| Video & Downloads | Embedded Links Only (YouTube) | Direct Hosting, Streaming & Granted Encrypted Downloads | 3 |
| Cloud Storage Quota | 500 MB Document Storage | Unlimited Storage (Cloudinary Backed CDN) | 3 |
| AI Academic Assistant | Disabled | Enabled (Qwen RAG-based subject tutoring) | 4 |
| Predictive Analytics | Basic Analytics | Early Warning System, Exam Predictions & AI Insights | 5 |
| Teacher Blogs & Resources | School-internal only | Publish to National Resource Marketplace | 6 |
| Smart Timetables | Manual entry | Algorithmic Constraint-based Generation | 6 |

## 8. Technology Stack Specifications (by Phase)

- **Phase 1:** Next.js 16+ (App Router, Turbopack, RSC, Tailwind CSS), NestJS REST APIs, supabase (schema-per-tenant), Redis (sessions).
- **Phase 2:** NestJS WebSockets (chat gateway), Twilio Programmable Messaging API (alphanumeric sender IDs, UTF-8), Redis (WebSocket state, SMS queues).
- **Phase 3:** Flutter (Dart), SQLite (sqflite) for offline storage, Cloudinary (HLS video transcoding, encrypted offline downloads).
- **Phase 4:** Python (FastAPI) AI engine, Meilisearch, dedicated Vector Database (Pinecone / Qdrant / Milvus), Qwen LLM.
- **Phase 5:** Scikit-learn / XGBoost for Early Warning and Exam Prediction models, served alongside the FastAPI AI engine.
- **Phase 6:** Google OR-Tools (Smart Timetable Generator), ClickHouse (Ministry Data Warehouse / OLAP), Prometheus, Grafana, OpenTelemetry, Sentry (national-scale observability).
- **Cross-cutting (all phases):** tour/coach-mark libraries (e.g., driver.js / Shepherd.js / react-joyride for web, tutorial_coach_mark or a custom overlay for Flutter), a central structured tutorial-content store (screen → steps → copy → media, translatable into Sinhala/Tamil/English), and bundled offline tutorial assets for mobile.
