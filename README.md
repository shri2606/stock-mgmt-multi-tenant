# Multi-tenant stock management: Shared Schema

Every tenant's data lives in the same tables, told apart by a `tenant_id`
column. Hibernate appends `where tenant_id = ?` to queries on its own, so no
controller or service has to know anything about tenancy.

## How it works

1. A request arrives with an `X-Tenant-ID` header, say `alpha`.
2. `TenantFilter` is a servlet filter at highest precedence. It reads that
   header, lowercases it, and puts it in `TenantContext`. No header means a
   `400`. It clears the context in a `finally` block, so the next request to
   land on that thread starts clean.
3. `TenantContext` is a `ThreadLocal<String>` with set, get, and clear.
4. `TenantHibernateFilter` is an `@Aspect` running `@Before` every method in
   `com.saas.multitenantapp.services`. It unwraps the Hibernate `Session` and
   calls `enableFilter("tenantFilter").setParameter("tenantId", ...)`.
5. `AbstractEntity` declares the `@FilterDef` named `tenantFilter`, with the
   condition `tenant_id = :tenantId`, plus the `@Filter` that switches it on.
6. Hibernate rewrites `select ... from categories` into
   `select ... from categories where tenant_id = ?`.

## Important

The service has to be `@Transactional`. The aspect gets its Session from the
EntityManager, and that Session only exists inside a transaction. Without one,
the filter is enabled on a throwaway Session that never runs your query, and
every tenant sees every row.

This one is easy to miss, because nothing fails loudly. You just get back more
rows than you should, and the SQL log is the only place it shows up.

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
All of them require the `X-Tenant-ID` header.

## Running

```bash
docker compose up -d          # Postgres 17.5 on host port 5433
./mvnw spring-boot:run        # app on :8080
```

Flyway owns the schema, from `db/migration/common`. V1 creates the tables, V2
adds `tenant_id` to all three. `ddl-auto` is set to `validate`.

```bash
curl -H 'X-Tenant-ID: alpha' localhost:8080/api/v1/categories
```

## Next steps

Approach 2: a schema per tenant. Rather than one shared set of tables with a
`tenant_id` column, each tenant gets its own Postgres schema, created for it
automatically.