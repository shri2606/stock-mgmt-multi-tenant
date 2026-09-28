package com.saas.multitenantapp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityNotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.RequestBuilder;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tenant isolation for approach 1, the single shared database.
 *
 * Runs against the Postgres in docker compose, the same one the app uses, and is
 * @Transactional so every row it writes is rolled back afterwards.
 *
 * Two deliberate choices:
 *   - Requests go through MockMvc, so TenantFilter and TenantHibernateFilter both
 *     run. Calling a service or repository directly would skip the filter and
 *     prove nothing.
 *   - Assertions about what is in the database use JdbcTemplate, not the
 *     repositories, because the Hibernate filter would scope a repository read
 *     to whichever tenant ran last and hide the very rows being checked.
 *
 * Cross-tenant requests are asserted as "not successful" rather than as 404.
 * Today they surface as 500 because there is no exception handler yet; when one
 * is added they become 404 and these tests should still pass.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class TenantIsolationTests {

    private static final String TENANT_HEADER = "X-Tenant-ID";
    private static final String TENANT_A = "test-tenant-a";
    private static final String TENANT_B = "test-tenant-b";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private EntityManager entityManager;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ---------------------------------------------------------------- listing

    @Test
    @DisplayName("a tenant's category listing excludes another tenant's rows")
    void categoryListingIsScopedToTheTenant() throws Exception {
        final String name = uniqueName("cat");
        createCategory(TENANT_A, name);

        assertThat(categoryNamesVisibleTo(TENANT_A)).contains(name);
        assertThat(categoryNamesVisibleTo(TENANT_B)).doesNotContain(name);
    }

    // ------------------------------------------------------------ read by id

    @Test
    @DisplayName("a tenant cannot read another tenant's category by id")
    void cannotReadAnotherTenantsCategoryById() throws Exception {
        final String name = uniqueName("cat");
        final String id = createCategory(TENANT_A, name);

        assertBlocked(get("/api/v1/categories/{id}", id)
                              .header(TENANT_HEADER, TENANT_B));

        // and the owner can still read it
        this.mockMvc.perform(get("/api/v1/categories/{id}", id)
                                     .header(TENANT_HEADER, TENANT_A))
                    .andExpect(status().isOk());
    }

    // --------------------------------------------------------------- update

    @Test
    @DisplayName("a tenant cannot update another tenant's category")
    void cannotUpdateAnotherTenantsCategory() throws Exception {
        final String name = uniqueName("cat");
        final String id = createCategory(TENANT_A, name);

        assertBlocked(put("/api/v1/categories/{id}", id)
                              .header(TENANT_HEADER, TENANT_B)
                              .contentType(MediaType.APPLICATION_JSON)
                              .content(categoryBody(uniqueName("hijacked"), "written by the wrong tenant")));

        assertThat(categoryNameInDatabase(id))
                .as("the owner's row must be untouched")
                .isEqualTo(name);
    }

    // --------------------------------------------------------------- delete

    @Test
    @DisplayName("a tenant cannot delete another tenant's category")
    void cannotDeleteAnotherTenantsCategory() throws Exception {
        final String id = createCategory(TENANT_A, uniqueName("cat"));

        assertBlocked(delete("/api/v1/categories/{id}", id)
                              .header(TENANT_HEADER, TENANT_B));

        assertThat(categoryExistsInDatabase(id))
                .as("the owner's row must still be there")
                .isTrue();
    }

    // ------------------------------------------------- cross-entity references

    @Test
    @DisplayName("a tenant cannot attach a product to another tenant's category")
    void cannotAttachProductToAnotherTenantsCategory() throws Exception {
        final String categoryId = createCategory(TENANT_A, uniqueName("cat"));
        final String reference = uniqueName("ref");

        assertBlocked(post("/api/v1/products")
                              .header(TENANT_HEADER, TENANT_B)
                              .contentType(MediaType.APPLICATION_JSON)
                              .content(productBody(uniqueName("prod"), reference, categoryId)));

        assertThat(productExistsInDatabase(reference))
                .as("no product may be written against another tenant's category")
                .isFalse();
    }

    @Test
    @DisplayName("a tenant cannot attach a stock movement to another tenant's product")
    void cannotAttachStockMvtToAnotherTenantsProduct() throws Exception {
        final String categoryId = createCategory(TENANT_A, uniqueName("cat"));
        final String reference = uniqueName("ref");
        final String productId = createProduct(TENANT_A, uniqueName("prod"), reference, categoryId);

        assertBlocked(post("/api/v1/stocks")
                              .header(TENANT_HEADER, TENANT_B)
                              .contentType(MediaType.APPLICATION_JSON)
                              .content(stockMvtBody(productId)));

        assertThat(stockMvtCountForProduct(productId))
                .as("no movement may be written against another tenant's product")
                .isZero();
    }

    @Test
    @DisplayName("a tenant cannot read another tenant's stock movement by id")
    void cannotReadAnotherTenantsStockMvtById() throws Exception {
        final String categoryId = createCategory(TENANT_A, uniqueName("cat"));
        final String productId = createProduct(TENANT_A, uniqueName("prod"), uniqueName("ref"), categoryId);
        final String stockMvtId = createStockMvt(TENANT_A, productId);

        assertBlocked(get("/api/v1/stocks/{id}", stockMvtId)
                              .header(TENANT_HEADER, TENANT_B));

        this.mockMvc.perform(get("/api/v1/stocks/{id}", stockMvtId)
                                     .header(TENANT_HEADER, TENANT_A))
                    .andExpect(status().isOk());
    }

    // ---------------------------------------------------------- the header

    @Test
    @DisplayName("a request without the tenant header is rejected")
    void requestWithoutTenantHeaderIsRejected() throws Exception {
        this.mockMvc.perform(get("/api/v1/categories"))
                    .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("a blank tenant header is rejected")
    void requestWithBlankTenantHeaderIsRejected() throws Exception {
        this.mockMvc.perform(get("/api/v1/categories").header(TENANT_HEADER, "   "))
                    .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("the tenant header is matched case-insensitively")
    void tenantHeaderIsCaseInsensitive() throws Exception {
        final String name = uniqueName("cat");
        createCategory(TENANT_A, name);

        // TenantFilter lowercases the header, so the upper-case spelling is the same tenant
        assertThat(categoryNamesVisibleTo(TENANT_A.toUpperCase())).contains(name);
    }

    // ------------------------------------------------------- the happy path

    @Test
    @DisplayName("a tenant can run the full lifecycle against its own rows")
    void ownerCanRunTheFullLifecycle() throws Exception {
        final String name = uniqueName("cat");
        final String categoryId = createCategory(TENANT_A, name);

        // an update that keeps the name must not trip the duplicate-name check
        this.mockMvc.perform(put("/api/v1/categories/{id}", categoryId)
                                     .header(TENANT_HEADER, TENANT_A)
                                     .contentType(MediaType.APPLICATION_JSON)
                                     .content(categoryBody(name, "changed description")))
                    .andExpect(status().isAccepted());

        final String renamed = uniqueName("cat");
        this.mockMvc.perform(put("/api/v1/categories/{id}", categoryId)
                                     .header(TENANT_HEADER, TENANT_A)
                                     .contentType(MediaType.APPLICATION_JSON)
                                     .content(categoryBody(renamed, "renamed")))
                    .andExpect(status().isAccepted());
        assertThat(categoryNameInDatabase(categoryId)).isEqualTo(renamed);

        final String productId = createProduct(TENANT_A, uniqueName("prod"), uniqueName("ref"), categoryId);
        final String stockMvtId = createStockMvt(TENANT_A, productId);

        this.mockMvc.perform(delete("/api/v1/stocks/{id}", stockMvtId).header(TENANT_HEADER, TENANT_A))
                    .andExpect(status().isNoContent());
        this.mockMvc.perform(delete("/api/v1/products/{id}", productId).header(TENANT_HEADER, TENANT_A))
                    .andExpect(status().isNoContent());
        this.mockMvc.perform(delete("/api/v1/categories/{id}", categoryId).header(TENANT_HEADER, TENANT_A))
                    .andExpect(status().isNoContent());

        assertThat(categoryExistsInDatabase(categoryId)).isFalse();
    }

    // -------------------------------------------------------------- helpers

    /**
     * Asserts a request was refused. Any 2xx means it went through, which for a
     * cross-tenant request is the failure being guarded against.
     *
     * The refusal takes one of two shapes depending on where the project is. Today
     * the service throws EntityNotFoundException and, with no exception handler
     * registered, MockMvc lets it escape from perform() rather than turning it into
     * a response. Once a handler is added the same request comes back as a 404.
     * Both mean blocked, so either is accepted and only a 2xx fails.
     */
    private void assertBlocked(final RequestBuilder request) throws Exception {
        try {
            final int status = this.mockMvc.perform(request).andReturn().getResponse().getStatus();
            assertThat(status < 200 || status >= 300)
                    .as("a cross-tenant request must not succeed, got HTTP %d", status)
                    .isTrue();
        } catch (final Exception e) {
            assertThat(NestedExceptionUtils.getMostSpecificCause(e))
                    .as("the request must be refused by the tenant filter, not by something else")
                    .isInstanceOf(EntityNotFoundException.class);
        }
    }

    private String uniqueName(final String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String categoryBody(final String name, final String description) {
        return """
               {"name":"%s","description":"%s"}
               """.formatted(name, description);
    }

    private String productBody(final String name, final String reference, final String categoryId) {
        return """
               {"name":"%s","reference":"%s","description":"d","alertThreshold":5,"price":9.99,"categoryId":"%s"}
               """.formatted(name, reference, categoryId);
    }

    private String stockMvtBody(final String productId) {
        return """
               {"typeMvt":"IN","quantity":10,"dateMvt":"2026-01-01","comment":"c","productId":"%s"}
               """.formatted(productId);
    }

    private String createCategory(final String tenant, final String name) throws Exception {
        this.mockMvc.perform(post("/api/v1/categories")
                                     .header(TENANT_HEADER, tenant)
                                     .contentType(MediaType.APPLICATION_JSON)
                                     .content(categoryBody(name, "d")))
                    .andExpect(status().isOk());
        return idOf("select id from categories where name = ?", name);
    }

    private String createProduct(final String tenant, final String name, final String reference,
                                 final String categoryId) throws Exception {
        this.mockMvc.perform(post("/api/v1/products")
                                     .header(TENANT_HEADER, tenant)
                                     .contentType(MediaType.APPLICATION_JSON)
                                     .content(productBody(name, reference, categoryId)))
                    .andExpect(status().isOk());
        return idOf("select id from products where reference = ?", reference);
    }

    private String createStockMvt(final String tenant, final String productId) throws Exception {
        this.mockMvc.perform(post("/api/v1/stocks")
                                     .header(TENANT_HEADER, tenant)
                                     .contentType(MediaType.APPLICATION_JSON)
                                     .content(stockMvtBody(productId)))
                    .andExpect(status().isOk());
        return idOf("select id from stock_mvts where product_id = ?", productId);
    }

    private List<String> categoryNamesVisibleTo(final String tenant) throws Exception {
        final String body = this.mockMvc.perform(get("/api/v1/categories")
                                                         .header(TENANT_HEADER, tenant)
                                                         .param("page", "0")
                                                         .param("size", "100"))
                                        .andExpect(status().isOk())
                                        .andReturn()
                                        .getResponse()
                                        .getContentAsString();
        final JsonNode content = this.objectMapper.readTree(body).path("content");
        return content.findValuesAsText("name");
    }

    /** Raw SQL, so the Hibernate filter cannot hide the row being asserted on. */
    private String idOf(final String sql, final String arg) {
        flush();
        return this.jdbcTemplate.queryForObject(sql, String.class, arg);
    }

    private String categoryNameInDatabase(final String id) {
        flush();
        return this.jdbcTemplate.queryForObject("select name from categories where id = ?", String.class, id);
    }

    private boolean categoryExistsInDatabase(final String id) {
        flush();
        final Integer count = this.jdbcTemplate.queryForObject(
                "select count(*) from categories where id = ?", Integer.class, id);
        return count != null && count > 0;
    }

    private boolean productExistsInDatabase(final String reference) {
        flush();
        final Integer count = this.jdbcTemplate.queryForObject(
                "select count(*) from products where reference = ?", Integer.class, reference);
        return count != null && count > 0;
    }

    private int stockMvtCountForProduct(final String productId) {
        flush();
        final Integer count = this.jdbcTemplate.queryForObject(
                "select count(*) from stock_mvts where product_id = ?", Integer.class, productId);
        return count == null ? 0 : count;
    }

    /** Push pending Hibernate writes to the connection so raw SQL can see them. */
    private void flush() {
        this.entityManager.flush();
    }
}
