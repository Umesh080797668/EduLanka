# EduLanka Pilot School Onboarding Walkthrough

Welcome to the EduLanka Pilot! This functional walkthrough covers all instructions necessary for our partner pilot schools transitioning onto the staging platform.

## Pre-Requisites
Ensure your administration team holds the `admin@pilot.edulanka.lk` login credentials provisioned. The initial school setup has been executed via our automated `seed-staging.ts` workflow initializing the `pilot_school_v1` tenant boundary.

## Walkthrough Scenarios
### 1. Global Setup (Institution Admin)
- Navigate to the **Policies Dashboard**.
- Define your overarching Grading Intervals (E.g. Term 1, Term 2, Term 3).
- Head to the **Account Management** center. You will see a host of pre-migrated User Accounts belonging to the `PilotTenant`.

### 2. Teacher Classroom Migration
- Ensure the teaching faculty logs in. First-time users will trigger the UI **Tutorial Walkthrough System**.
- Teachers can interact with their pre-assigned demonstration classroom, launching the explicit **Gradebook**. 
- Add mock values mapping to the newly defined global Grading Interval!

### 3. Verification View (Student and Parent)
- Execute cross-role evaluation: Login as `student@pilot.edulanka.lk` or `parent@pilot.edulanka.lk`.
- Within the **Grades Workspace**, ensure the mock inputs from the internal teachers successfully map to the Report Card interface.
- Validate **PDF Exports** format correctly on target machines without hanging.

## Pilot Support Hand-off
Should there be any functional roadblocks executing step arrays, report back via the formal tracking thread! All errors will trigger verbose diagnostic output downstream via global `HttpLoggerMiddleware` logs configured on `port:8081`.
