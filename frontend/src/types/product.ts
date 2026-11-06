export type Product = {
  id: number;
  name: string;
  barcode: string;
  category: string;
  product_type?: string;
  brand?: string;
  model?: string;
  reference?: string;
  compatible_models?: string;
  buy_price: number;
  sell_price: number;
  quantity: number;
  minimum_stock: number;
  created_at: string;
  updated_at: string;
};

export type CreateProductInput = {
  name: string;
  barcode: string;
  category: string;
  productType?: string;
  brand?: string;
  model?: string;
  reference?: string;
  compatibleModels?: string;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  minimumStock: number;
};
