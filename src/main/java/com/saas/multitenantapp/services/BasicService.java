package com.saas.multitenantapp.services;

import com.saas.multitenantapp.common.PageResponse;

public interface BasicService <I, O>{
    void create(final I request);

    void update(final String Id, final I request);

    O findById(final String id);

    PageResponse<O> findAll(final int page, final int size);
    void delete(final String id);
}
