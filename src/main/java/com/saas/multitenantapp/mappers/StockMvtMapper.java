package com.saas.multitenantapp.mappers;

import com.saas.multitenantapp.entities.Product;
import com.saas.multitenantapp.entities.StockMvt;
import com.saas.multitenantapp.requests.StockMvtRequest;
import com.saas.multitenantapp.responses.StockMvtResponse;
import org.springframework.stereotype.Component;

@Component
public class StockMvtMapper {

    public StockMvt toEntity(final StockMvtRequest request) {
        return StockMvt.builder()
                       .dateMvt(request.getDateMvt())
                       .comment(request.getComment())
                       .typeMvt(request.getTypeMvt())
                       .quantity(request.getQuantity())
                       .product(Product.builder()
                                       .id(request.getProductId())
                                       .build())
                       .build();
    }

    public StockMvtResponse toResponse(final StockMvt entity) {
        return StockMvtResponse.builder()
                               .id(entity.getId())
                               .dateMvt(entity.getDateMvt())
                               .comment(entity.getComment())
                               .typeMvt(entity.getTypeMvt())
                               .quantity(entity.getQuantity())
                               .build();
    }
}
