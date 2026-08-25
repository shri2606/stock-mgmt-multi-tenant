package com.saas.multitenantapp.mappers;

import com.saas.multitenantapp.entities.Category;
import com.saas.multitenantapp.requests.CategoryRequest;
import com.saas.multitenantapp.responses.CategoryResponse;
import org.springframework.stereotype.Component;

@Component
public class CategoryMapper {

    public Category toEntity(final CategoryRequest request){
        return Category.builder()
                .name(request.getName())
                .description(request.getDescription())
                .build();
    }

    public CategoryResponse toResponse(final Category entity){
        return CategoryResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .build();
    }
}
