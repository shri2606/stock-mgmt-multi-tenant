# Multi-Tenant Stock Management — Approach 1: Shared Schema

A single database, a single schema, and every row tagged with a `tenant_id`.
Hibernate appends `where tenant_id = ?` to queries automatically, so services
and controllers contain no tenant-aware code.

## How it works

1. **Request** arrives with an `X-Tenant-ID` header (e.g. `alpha`).
2. **`TenantFilter`** (servlet filter, highest precedence) reads the header,
   lowercases it, and stores it in `TenantContext`. Missing header → `400`.
   The context is cleared in a `finally` block so threads aren't reused dirty.
3. **`TenantContext`** is a `ThreadLocal<String>` — set / get / clear.
4. **`TenantHibernateFilter`** is an `@Aspect` that runs `@Before` any method in
   `com.saas.multitenantapp.services`. It unwraps the Hibernate `Session` and
   calls `enableFilter("tenantFilter").setParameter("tenantId", ...)`.
5. **`AbstractEntity`** declares `@FilterDef(name = "tenantFilter", ...)` with
   the condition `tenant_id = :tenantId`, plus the `@Filter` that activates it.
6. **Hibernate** rewrites `select ... from categories` into
   `select ... from categories where tenant_id = ?`.

## Important

The service must be `@Transactional`. The aspect obtains the Session from the
EntityManager, and that Session only exists inside a transaction — without it
the filter is enabled on a throwaway Session and every tenant sees every row.

## Layout

```
common/       AbstractEntity (tenant_id, auditing, soft-delete flag), PageResponse
config/       TenantContext, TenantFilter, TenantHibernateFilter
entities/     Category, Product, StockMvt, TypeMvt
repositories/ mappers/ requests/ responses/
services/     BasicService<I,O> + per-entity interfaces, impl/
controllers/  CategoryController, ProductController, StockMvtController
```

## Endpoints

`/api/v1/categories`, `/api/v1/products`, `/api/v1/stocks`

Each supports POST, PUT `/{id}`, GET `/{id}`, GET `?page=&size=`, DELETE `/{id}`.
All require the `X-Tenant-ID` header.

## Running

```bash
docker compose up -d          # Postgres 17.5 on host port 5433
./mvnw spring-boot:run        # app on :8080
```

Flyway owns the schema (`db/migration/common`): **V1** creates the tables,
**V2** adds `tenant_id` to all three. `ddl-auto` is `validate`.

```bash
curl -H 'X-Tenant-ID: alpha' localhost:8080/api/v1/categories
```

## Known gaps

- `X-Tenant-ID` is self-asserted — no authentication yet, so any caller can
  claim any tenant. Security comes with approach 2.
- `findById` bypasses the filter entirely: Hibernate `@Filter` does not apply
  to primary-key lookups, so GET/PUT/DELETE by id can reach another tenant's row.
- Unique constraints on `categories.name` and `products.reference` are global,
  so two tenants can't reuse the same name or reference.
- Request DTOs carry no validation annotations, and there's no exception
  handler, so bad input surfaces as a 500.
