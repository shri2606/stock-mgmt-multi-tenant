# Multi-Tenant Stock Management — Approach 1: Shared Schema

A single database, a single schema, and every row tagged with a `tenant_id`.
Hibernate appends `where tenant_id = ?` to queries automatically, so services
and controllers contain no tenant-aware code.

## How it works

```mermaid
flowchart TD
    A["HTTP Request<br/>X-Tenant-ID: alpha"]
    B{"TenantFilter<br/>header present?"}
    E["400 Bad Request<br/>tenant ID is missing"]
    C["TenantContext<br/>ThreadLocal = 'alpha'"]
    D["Controller then Service<br/>@Transactional"]
    F["TenantHibernateFilter @Before<br/>session.enableFilter('tenantFilter')<br/>.setParameter('tenantId', 'alpha')"]
    G["Hibernate rewrites the SQL"]
    H["select * from categories<br/>where tenant_id = 'alpha'"]
    I["Response: only alpha's rows"]
    J["finally: TenantContext.clear()"]

    A --> B
    B -- no --> E
    B -- yes --> C
    C --> D
    D --> F
    F --> G
    G --> H
    H --> I
    I --> J
```

The header names the tenant, a `ThreadLocal` carries it through the request, and
an aspect turns it into a `where` clause. Nothing in the controllers or services
mentions tenancy.

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
