package com.saas.multitenantapp.requests;

import com.saas.multitenantapp.entities.TypeMvt;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class StockMvtRequest {

    private TypeMvt typeMvt;
    private Integer quantity;
    private LocalDate dateMvt;
    private String comment;
    private String productId;
}
