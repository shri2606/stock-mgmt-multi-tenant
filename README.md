# Multi-Tenant Stock Management — Approach 1: Shared Schema

A single database, a single schema, and every row tagged with a `tenant_id`.
Hibernate appends `where tenant_id = ?` to queries automatically, so services
and controllers contain no tenant-aware code.

## How it works

All tenants share one database and one set of tables. Rows are separated by a
`tenant_id` column, and Hibernate adds the `where` clause for you.

```mermaid
sequenceDiagram
    autonumber
    actor A as Tenant A (alpha)
    participant F as TenantFilter
    participant C as TenantContext
    participant S as Service (@Transactional)
    participant X as TenantHibernateFilter
    participant H as Hibernate
    participant DB as PostgreSQL (shared)

    A->>F: GET /api/v1/products (X-Tenant-ID: alpha)
    F->>F: resolveHeader()

    alt header missing or blank
        F-->>A: 400 - tenant ID is missing
    else header present
        F->>C: setCurrentTenant("alpha")
        F->>S: invoke service method
        Note over X: @Before advice fires
        X->>C: getCurrentTenant()
        C-->>X: "alpha"
        X->>H: enableFilter("tenantFilter").setParameter("tenantId", "alpha")
        S->>H: repository.findAll(pageable)
        H->>DB: select * from products where tenant_id = 'alpha'
        DB-->>H: only tenant A rows
        H-->>S: Page of Product
        S-->>A: 200 - tenant A rows only
    end

    F->>C: clear()
```

Tenant B sends the same request with `X-Tenant-ID: beta` and reaches the same
instance and the same table, but Hibernate scopes the query to `beta`, so the
two tenants never see each other's rows.

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
