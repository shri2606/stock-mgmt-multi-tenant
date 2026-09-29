// Mirrors the backend DTOs in com.saas.multitenantapp.{requests,responses}.
// Fields are optional because the Java DTOs have no nullability contract.

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  first: boolean;
  last: boolean;
}

export interface CategoryResponse {
  id?: string;
  name?: string;
  description?: string;
}

export interface CategoryRequest {
  name: string;
  description?: string;
}

export interface ProductResponse {
  /** Not returned by the backend yet. Edit and delete stay disabled without it. */
  id?: string;
  /** Not returned by the backend yet. Needed to preselect the category on edit. */
  categoryId?: string;
  name?: string;
  reference?: string;
  description?: string;
  alertThreshold?: number;
  price?: number;
  categoryName?: string;
  /** Always 0 today: ProductMapper leaves it "to be later implemented". */
  availableQuantity?: number;
}

export interface ProductRequest {
  name: string;
  reference: string;
  description?: string;
  alertThreshold?: number;
  price?: number;
  categoryId: string;
}

export type TypeMvt = 'IN' | 'OUT';

export interface StockMvtResponse {
  /** Not returned by the backend yet. Edit and delete stay disabled without it. */
  id?: string;
  typeMvt?: TypeMvt;
  quantity?: number;
  dateMvt?: string;
  comment?: string;
}

export interface StockMvtRequest {
  typeMvt: TypeMvt;
  quantity?: number;
  dateMvt: string;
  comment?: string;
  productId: string;
}
