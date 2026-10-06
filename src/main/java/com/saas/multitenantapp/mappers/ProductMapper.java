package com.saas.multitenantapp.mappers;

import com.saas.multitenantapp.entities.Category;
import com.saas.multitenantapp.entities.Product;
import com.saas.multitenantapp.requests.ProductRequest;
import com.saas.multitenantapp.responses.ProductResponse;
import org.springframework.stereotype.Component;

@Component
public class ProductMapper {

    public Product toEntity(final ProductRequest request) {
        return Product.builder()
                      .name(request.getName())
                      .reference(request.getReference())
                      .description(request.getDescription())
                      .price(request.getPrice())
                      .alertThreshold(request.getAlertThreshold())
                      .category(Category.builder()
                                        .id(request.getCategoryId())
                                        .build())
                      .build();
    }

    public ProductResponse toResponse(final Product product) {
        return ProductResponse.builder()
                              .id(product.getId())
                              .name(product.getName())
                              .reference(product.getReference())
                              .description(product.getDescription())
                              .price(product.getPrice())
                              .alertThreshold(product.getAlertThreshold())
                              .categoryId(product.getCategory()
                                                 .getId())
                              .categoryName(product.getCategory()
                                                   .getName())
                              // .availableQuantity() to be later implemented
                              .build();
    }
}
