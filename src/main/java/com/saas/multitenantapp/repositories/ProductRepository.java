package com.saas.multitenantapp.repositories;

import com.saas.multitenantapp.entities.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, String> {

    Optional<Product> findByReferenceIgnoreCase(String reference);

    // findById bypasses the tenant filter, Hibernate only applies it to queries
    Optional<Product> findOneById(final String id);
}
