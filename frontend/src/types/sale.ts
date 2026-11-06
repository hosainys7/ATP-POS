export type CartItem = {
  productId: number;
  name: string;
  barcode: string;
  quantity: number;
  unitPrice: number;
  availableStock: number;
  productType?: string;
  category?: string;
  brand?: string;
  model?: string;
};

export type RepairCartItem = {
  repairId: number;
  label: string;
  clientName: string;
  scooter: string;
  total: number;
};

export type SaleItem = {
  id: number;
  product_id: number;
  product_name: string;
  barcode: string;
  quantity: number;
  returned_quantity?: number;
  unit_price: number;
  total: number;
};

export type SaleRepairItem = {
  id: number;
  repair_id: number;
  description: string;
  unit_price: number;
  total: number;
  client_name: string;
  brand: string;
  model: string;
};

export type SaleReturn = {
  id: number;
  sale_id: number;
  return_number: string;
  payment_method: string;
  total: number;
  reason: string;
  created_at: string;
  items?: Array<{
    id: number;
    sale_item_id: number;
    product_id: number;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
};

export type SaleSummary = {
  id: number;
  sale_number: string;
  payment_method: string;
  subtotal: number;
  total: number;
  paid: number;
  status?: "Validée" | "Annulée";
  cash_received?: number | null;
  change_due?: number;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  returned_total?: number;
  net_total?: number;
  created_at: string;
};

export type Sale = SaleSummary & {
  items: SaleItem[];
  repair_items: SaleRepairItem[];
  returns?: SaleReturn[];
};
