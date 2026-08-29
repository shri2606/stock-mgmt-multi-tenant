package com.saas.multitenantapp.services.impl;

import com.saas.multitenantapp.common.PageResponse;
import com.saas.multitenantapp.entities.Category;
import com.saas.multitenantapp.mappers.CategoryMapper;
import com.saas.multitenantapp.repositories.CategoryRepository;
import com.saas.multitenantapp.requests.CategoryRequest;
import com.saas.multitenantapp.responses.CategoryResponse;
import com.saas.multitenantapp.services.CategoryService;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CategoryServiceImpl implements CategoryService {

    private final CategoryRepository categoryRepository;
    private final CategoryMapper categoryMapper;
    @Override
    public void create(CategoryRequest request) {
    // first check if the category already exists
        checkIfCategoryExistsByName(request.getName());

        final Category category = categoryMapper.toEntity(request);
        this.categoryRepository.save(category);
    }



    @Override
    public void update(String id, CategoryRequest request) {
        final Optional<Category> existingCategory = this.categoryRepository.findById(id);
        if(existingCategory.isEmpty()){
            log.debug("Category not found");
            throw new EntityNotFoundException("Category not found");
        }

        final Category category = existingCategory.get();

        if(!category.getName()
                .equalsIgnoreCase(request.getName())){
            checkIfCategoryExistsByName(request.getName());
        }
        final Category updatedCategory = categoryMapper.toEntity(request);
        updatedCategory.setId(id);
        this.categoryRepository.save(updatedCategory);

    }

    @Override
    public CategoryResponse findById(String id) {
        return this.categoryRepository.findById(id)
                .map(this.categoryMapper::toResponse)
                .orElseThrow(() -> new EntityNotFoundException(("Category not found")));
    }

    @Override
    public PageResponse<CategoryResponse> findAll(final int page, final int size) {
        final PageRequest pageRequest = PageRequest.of(page, size);
        final Page<Category> categories = this.categoryRepository.findAll(pageRequest);
        final Page<CategoryResponse> categoryResponses = categories.map(this.categoryMapper::toResponse);
        return PageResponse.of(categoryResponses);
    }

    @Override
    public void delete(String id) {
        final Category category = this.categoryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException(("Category not found")));

        this.categoryRepository.delete(category);

    }

    private void checkIfCategoryExistsByName(String name) {
        final Optional<Category> category = this.categoryRepository.findByNameIgnoreCase(name);
        if(category.isPresent()){
            log.debug("Category already exists");
            throw new RuntimeException("Category already exists");
        }
    }
}
