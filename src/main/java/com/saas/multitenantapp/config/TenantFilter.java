package com.saas.multitenantapp.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TenantFilter implements Filter {

    private static final String TENANT_HEADER = "X-Tenant-ID";

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain) throws IOException, ServletException {
        final HttpServletRequest request = (HttpServletRequest) servletRequest;
        final HttpServletResponse response = (HttpServletResponse) servletResponse;

        final String tenantId = resolveHeader(request);
        if(tenantId == null || tenantId.isBlank()){
            response.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Tenant ID is missing in the request header, please add the X-Tenant-ID\"}");
            return;
        }
        try{
            TenantContext.setCurrentTenant(tenantId);
            filterChain.doFilter(servletRequest, servletResponse);
        }finally {
            TenantContext.clear();
        }
    }

    private String resolveHeader(HttpServletRequest request) {
        final String tenantId = request.getHeader(TENANT_HEADER);
        if(tenantId != null && !tenantId.isBlank()){
            return  tenantId.toLowerCase();
        }
        return null;
    }
}
