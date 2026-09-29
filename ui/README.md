# Stock Management UI

React + Vite front end for the shared-schema backend.

```bash
npm install
npm run dev     # http://localhost:5173
```

The backend must be running on :8080 (`./mvnw spring-boot:run`) with Postgres up
(`docker compose up -d`). Vite proxies `/api` to it, so the browser only ever
talks to :5173 and the backend needs no CORS configuration.

## Tenancy

There is no login. The tenant is typed into the switcher in the top bar, stored
in `localStorage`, and sent as `X-Tenant-ID` on every request. Nothing verifies
it, so the header is self-asserted. Switching tenants in the UI is the quickest
way to see isolation working.

`src/lib/api.ts` is the only file that knows how the tenant reaches the backend.
If the tenant ever comes from a signed token instead, that one function is the
only thing that changes; no page touches it.

## Known gaps, caused by the API

- `ProductResponse` and `StockMvtResponse` have no `id`, so **edit and delete are
  disabled** on those two screens, and a stock movement cannot be created at all
  (it needs a `productId` that the products list does not return).
- `ProductResponse` has no `categoryId`, so an edited product cannot preselect
  its category.
- `availableQuantity` is always `0`: `ProductMapper` leaves it "to be later
  implemented".

Categories are unaffected and support the full create / edit / delete cycle.
