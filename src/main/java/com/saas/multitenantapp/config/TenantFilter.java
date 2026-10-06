package com.saas.multitenantapp.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Pulls the tenant off the request and into {@link TenantContext} for the
 * duration of the call.
 *
 * Deliberately not a @Component: SecurityConfig constructs it and places it
 * after the bearer token filter. Registering it as a bean as well would have the
 * servlet container run it a second time, outside the security chain.
 */
public class TenantFilter extends OncePerRequestFilter {

    private static final String TENANT_HEADER = "X-Tenant-ID";

    @Override
    protected void doFilterInternal(final HttpServletRequest request,
                                    final HttpServletResponse response,
                                    final FilterChain filterChain) throws ServletException, IOException {
        final String tenantId = resolveHeader(request);
        if (tenantId == null) {
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json");
            response.getWriter()
                    .write("{\"error\": \"Tenant ID is missing in the request header, please add the X-Tenant-ID\"}");
            return;
        }
        try {
            TenantContext.setCurrentTenant(tenantId);
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private String resolveHeader(final HttpServletRequest request) {
        final String tenantId = request.getHeader(TENANT_HEADER);
        if (tenantId != null && !tenantId.isBlank()) {
            return tenantId.toLowerCase();
        }
        return null;
    }
}
