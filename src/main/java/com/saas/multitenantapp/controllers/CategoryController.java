package com.saas.multitenantapp.controllers;

import com.saas.multitenantapp.requests.CategoryRequest;
import com.saas.multitenantapp.responses.CategoryResponse;
import com.saas.multitenantapp.services.CategoryService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {
    private final CategoryService service;

    @PostMapping
    public ResponseEntity<Void> createCategory(
            @RequestBody
            @Valid
            final CategoryRequest request
    ) {
        this.service.create(request);
        return ResponseEntity.ok().build();
    }



    @PutMapping("/{category-id}")
    public ResponseEntity<Void> updateCategory(
            @RequestBody
            @Valid
            final CategoryRequest request,
            @PathVariable("category-id")
            @NotNull(message = "Category ID cannot be null")
            final String id
    ) {
        this.service.update(id, request);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/{category-id}")
    public ResponseEntity<CategoryResponse> findCategoryById(
            @PathVariable("category-id")
            @NotNull(message = "Category ID cannot be null")
            final String id
    ) {
        return ResponseEntity.ok(this.service.findById(id));
    }
    @GetMapping
    public ResponseEntity<List<CategoryResponse>> getAllCategories(){
        return ResponseEntity.ok(this.service.findAll());
    }

//    @GetMapping
//    public ResponseEntity<PageResponse<CategoryResponse>> findAllCategories(
//            @RequestParam(name = "page", defaultValue = "0")
//            final int page,
//            @RequestParam(name = "size", defaultValue = "10")
//            final int size
//    ) {
//        return ResponseEntity.ok(this.service.findAll(page, size));
//    }

    @DeleteMapping("/{category-id}")
    public ResponseEntity<Void> deleteCategory(
            @PathVariable("category-id")
            @NotNull(message = "Category ID cannot be null")
            final String id
    ) {
        this.service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
