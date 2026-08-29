package com.saas.multitenantapp.repositories;

import com.saas.multitenantapp.entities.StockMvt;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockMvtRepository extends JpaRepository<StockMvt, String> {
}
