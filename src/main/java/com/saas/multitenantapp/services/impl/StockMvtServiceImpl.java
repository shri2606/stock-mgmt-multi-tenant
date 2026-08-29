package com.saas.multitenantapp.services.impl;

import com.saas.multitenantapp.common.PageResponse;
import com.saas.multitenantapp.entities.Product;
import com.saas.multitenantapp.entities.StockMvt;
import com.saas.multitenantapp.mappers.StockMvtMapper;
import com.saas.multitenantapp.repositories.ProductRepository;
import com.saas.multitenantapp.repositories.StockMvtRepository;
import com.saas.multitenantapp.requests.StockMvtRequest;
import com.saas.multitenantapp.responses.StockMvtResponse;
import com.saas.multitenantapp.services.StockMvtService;
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
public class StockMvtServiceImpl implements StockMvtService {

    private final StockMvtRepository stockMvtRepository;
    private final ProductRepository productRepository;
    private final StockMvtMapper stockMvtMapper;

    @Override
    public void create(final StockMvtRequest request) {
        // check if product exists
        checkIfProductExistsById(request.getProductId());

        final StockMvt entity = this.stockMvtMapper.toEntity(request);
        this.stockMvtRepository.save(entity);
    }

    @Override
    public void update(final String id, final StockMvtRequest request) {
        final Optional<StockMvt> stockMvt = this.stockMvtRepository.findById(id);
        if (stockMvt.isEmpty()) {
            log.debug("StockMvt does not exist");
            throw new EntityNotFoundException("StockMvt does not exist");
        }

        // check if product exists
        checkIfProductExistsById(request.getProductId());

        final StockMvt stockMvtToUpdate = this.stockMvtMapper.toEntity(request);
        stockMvtToUpdate.setId(id);
        this.stockMvtRepository.save(stockMvtToUpdate);
    }

    @Override
    public PageResponse<StockMvtResponse> findAll(final int page, final int size) {
        final PageRequest pageRequest = PageRequest.of(page, size);
        final Page<StockMvt> stockMvts = this.stockMvtRepository.findAll(pageRequest);
        final Page<StockMvtResponse> stockMvtResponses = stockMvts.map(this.stockMvtMapper::toResponse);
        return PageResponse.of(stockMvtResponses);
    }

    @Override
    public StockMvtResponse findById(final String id) {
        return this.stockMvtRepository.findById(id)
                                      .map(this.stockMvtMapper::toResponse)
                                      .orElseThrow(() -> new EntityNotFoundException("StockMvt does not exist"));
    }

    @Override
    public void delete(final String id) {
        final StockMvt stockMvt = this.stockMvtRepository.findById(id)
                                                         .orElseThrow(() -> new EntityNotFoundException("StockMvt does not exist"));
        this.stockMvtRepository.delete(stockMvt);

    }

    private void checkIfProductExistsById(final String productId) {
        final Optional<Product> product = this.productRepository.findById(productId);
        if (product.isEmpty()) {
            log.debug("Product does not exist");
            throw new EntityNotFoundException("Product does not exist");
        }
    }
}
