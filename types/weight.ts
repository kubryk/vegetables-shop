export type WeightMode =
  | 'by_invoice_quantity'
  | 'per_unit_exact'
  | 'per_package_exact'
  | 'manual_per_order'
  | 'unknown';

export type WeightSource = 'exact' | 'manual' | 'unknown';
