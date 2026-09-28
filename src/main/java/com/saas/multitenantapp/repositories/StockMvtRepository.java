package com.saas.multitenantapp.repositories;

import com.saas.multitenantapp.entities.StockMvt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface StockMvtRepository extends JpaRepository<StockMvt, String> {

    // findById bypasses the tenant filter, Hibernate only applies it to queries
    Optional<StockMvt> findOneById(final String id);
}
