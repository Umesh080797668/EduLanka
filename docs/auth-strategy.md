# Auth Strategy — EduLanka

## Decision: Stateless JWT + Redis Refresh Token Denylist

| Aspect | Decision |
|---|---|
| Primary auth mechanism | **JWT (HS256)** — stateless, horizontally scalable |
| Access token TTL | **15 minutes** (`JWT_EXPIRES_IN`) |
| Refresh token TTL | **7 days** (`JWT_REFRESH_EXPIRES_IN`) |
| Token transport | `Authorization: Bearer <token>` header |
| Revocation mechanism | **Redis denylist** keyed by `jti` (JWT ID) |
| Password reset | **Supabase Auth** `resetPasswordForEmail` — delegates email delivery |

### Why JWT over server-side sessions?
- The platform is multi-tenant and must scale horizontally; sticky sessions would require a load balancer constraint.
- NestJS guards can validate JWTs without a DB round-trip on every request.
- Supabase Auth is already the identity provider; we add our application layer on top.

### Why a refresh token denylist (not full session storage)?
- Full server-side sessions would make every API request Redis-dependent.
- A denylist only matters during token rotation and logout — the common case (valid access token) remains stateless.

---

## Role Model

| Role | Scope | Typical capabilities |
|---|---|---|
| `STUDENT` | Tenant | View own grades, attendance, timetable |
| `PARENT` | Tenant | View child's data, receive notifications |
| `TEACHER` | Tenant | Manage classes, enter grades, view timetable |
| `SCHOOL_ADMIN` | Tenant | Full access within their school tenant |
| `ZONAL_OFFICER` | Zonal | Read-only view across schools in their zone |
| `MOE_OFFICER` | National | Read-only national analytics |
| `SUPER_ADMIN` | Platform | Provision tenants, manage all data |

---

## Auth Flow

### Login / Signup
```
Client → POST /api/v1/auth/login  (email, password, tenantId)
       → Supabase signInWithPassword
       → Resolve tenant (public.tenants) + user (tenant_<slug>.users)
       → Issue JWT pair with jti (UUID) embedded
       → Store refresh jti in Redis: edulanka:rt:{jti} → userId  EX 7d
       ← { accessToken, refreshToken, expiresIn }
```

### Token Refresh (rotation)
```
Client → POST /api/v1/auth/refresh  (refreshToken)
       → Verify JWT signature + expiry
       → Check Redis: edulanka:rt:{jti}  EXISTS?
       → DEL old jti
       → Issue new pair (new jti stored in Redis)
       ← { accessToken, refreshToken, expiresIn }
```

### Logout
```
Client → POST /api/v1/auth/logout  (Bearer accessToken, body: refreshToken)
       → JwtAuthGuard validates access token
       → Verify refresh token, extract jti
       → DEL edulanka:rt:{jti}
       ← 204 No Content
```

### Password Reset
```
Client → POST /api/v1/auth/forgot-password  (email, tenantId)
       → Supabase sends reset email (redirect URL includes tenantId)
       ← 200 { message: "If that email is registered..." } (always — no user enumeration)

User clicks email link → lands on /reset-password?tenantId=...
Client → POST /api/v1/auth/reset-password  (accessToken from URL hash, newPassword)
       → Supabase updateUser with session derived from token
       ← 200 { message: "Password has been reset." }
```

---

## NGINX Rate Limiting

Auth endpoints already have the tightest rate limit zone in `infrastructure/nginx/conf.d/edu-lanka.conf`:

```
limit_req_zone $binary_remote_addr zone=api_auth:10m rate=5r/m;
location ~ ^/api/v[0-9]+/auth/ {
    limit_req zone=api_auth burst=3 nodelay;
    ...
}
```

---

## Guard Application Order

Always apply in this order:

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN)
```

1. `JwtAuthGuard` — validates the Bearer token, populates `request.user`
2. `TenantGuard` — verifies `x-tenant-id` header matches `request.user.tenantId`
3. `RolesGuard` — checks `request.user.role` against `@Roles()` metadata
