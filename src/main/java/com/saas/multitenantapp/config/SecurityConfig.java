package com.saas.multitenantapp.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Entra ID authenticates the caller. It does not decide the tenant.
 *
 * The directory is fixed, so a single issuer-uri is enough and the token's tid
 * claim is the same for everyone. Tenancy still arrives as the X-Tenant-ID
 * header and is still self-asserted; a login in front of it does not change
 * that.
 */
@Configuration
public class SecurityConfig {

    /**
     * The API docs describe the API itself, so they carry neither a token nor a
     * tenant. They need a chain of their own rather than a permitAll rule in the
     * chain below: permitAll decides whether a request must be authenticated, not
     * whether the filters run, so TenantFilter would still reject them with a 400.
     * This is the one place the doc paths are named.
     */
    @Bean
    @Order(1)
    SecurityFilterChain docsFilterChain(final HttpSecurity http) throws Exception {
        return http
                .securityMatcher("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .build();
    }

    @Bean
    @Order(2)
    SecurityFilterChain apiFilterChain(final HttpSecurity http) throws Exception {
        return http
                // Stateless bearer tokens: no session to ride on, so no CSRF to forge.
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()))
                // After AuthorizationFilter, not after BearerTokenAuthenticationFilter.
                // AuthorizationFilter is what enforces authenticated() and it sits at
                // the end of the chain, so placing the tenant filter next to the bearer
                // filter would run it before authorization: a caller with no token and
                // no tenant header got a 400 telling it which header to add, instead of
                // a 401. requestWithoutTokenOrTenantIsUnauthorized covers that case.
                .addFilterAfter(new TenantFilter(), AuthorizationFilter.class)
                .build();
    }
}
