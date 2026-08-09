# EduLanka Security & IAM Review

## Identity & Access Management (IAM)
EduLanka implements a robust Role-Based Access Control (RBAC) architecture supported by the `RolesGuard` and strict session revocation loops. The following matrix governs access within our multi-tenant ecosystem:

- **STUDENT**: Bound strictly to isolated Grade Views and Report Card fetching for self.
- **PARENT**: Bound strictly to their linked student dependents' Grades and Profile Data.
- **TEACHER**: Authorized for Gradebook modifications and student attendance specifically for their managed cohorts.
- **SCHOOL_ADMIN**: Tenant-scoped institutional administration, policy management, and user provisioning.
- **SUPER_ADMIN**: Global system management spanning tenant-agnostic operations.

## Multi-Tenancy & Data Isolation (Sprint 7 Findings)
Our `TenantGuard` architecture successfully isolates schemas based on the evaluated `x-tenant-id` HTTP request headers. 
During the Sprint 7 review process, a strict isolation failure logic was addressed:
*   Before: Cross-tenant administration was fatally rejected universally for any mismatching headers.
*   Patch: A bypass check `user.role === 'SUPER_ADMIN'` was integrated within `TenantGuard`, restoring absolute global visibility to root administrators without compromising the boundary encapsulation expected for `SCHOOL_ADMIN` accounts and below.

## Sub-System Vulnerability Management
- **Stateless JSON Web Tokens**: Core access keys hold restricted 15-minute TTL constraints.
- **Data Transport Boundaries**: `Playwright` workflows successfully validate complete UI redirect lockdowns for undocumented route traversal attempts.
