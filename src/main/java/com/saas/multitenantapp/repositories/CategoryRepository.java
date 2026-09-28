package com.saas.multitenantapp.repositories;

import com.saas.multitenantapp.entities.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CategoryRepository extends JpaRepository<Category, String> {
    Optional<Category> findByNameIgnoreCase(String name);

    // findById bypasses the tenant filter, Hibernate only applies it to queries
    Optional<Category> findOneById(final String id);
}
