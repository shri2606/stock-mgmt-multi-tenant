# Multi-tenant stock management: Shared Schema

Every tenant's data lives in the same tables, told apart by a `tenant_id`
column. Hibernate appends `where tenant_id = ?` to queries on its own, so no
controller or service has to know anything about tenancy.

## How it works

1. The request comes in with an `X-Tenant-ID` header, for example `alpha`.
2. `TenantFilter` reads that header and remembers it for the rest of the
   request. A request without the header is rejected with a `400`.
3. Before any service method runs, `TenantHibernateFilter` picks up the
   remembered tenant and switches on a Hibernate filter for it.
4. Hibernate then adds `where tenant_id = 'alpha'` to the queries it
   generates, so a tenant only ever sees its own rows.

The filter is defined once on `AbstractEntity`, which every entity extends.
That is the only place tenancy shows up in the model.

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

I will be updating the project to "schema per tenant". Rather than one shared set of tables with a
`tenant_id` column, each tenant gets its own Postgres schema, created for it
automatically.