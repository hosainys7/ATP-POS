import type { CreateProductInput, Product } from "../types/product";
import type { Sale, SaleSummary } from "../types/sale";
import type { Repair } from "../types/repair";

const API_URL = "http://localhost:3001/api";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.message || "Une erreur est survenue.");
  }
  return response.json();
}

export async function getProducts(): Promise<Product[]> {
  return handleResponse<Product[]>(await fetch(`${API_URL}/products`));
}

export async function getProductByBarcode(barcode: string): Promise<Product> {
  return handleResponse<Product>(await fetch(`${API_URL}/products/barcode/${encodeURIComponent(barcode)}`));
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  return handleResponse<Product>(await fetch(`${API_URL}/products`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function updateProduct(productId: number, input: Omit<CreateProductInput, "quantity">): Promise<Product> {
  return handleResponse<Product>(await fetch(`${API_URL}/products/${productId}`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function addStock(productId: number, quantity: number): Promise<Product> {
  return handleResponse<Product>(await fetch(`${API_URL}/products/${productId}/stock`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity }),
  }));
}

export async function createSale(
  items: Array<{ productId: number; quantity: number }>,
  paymentMethod: "Espèces" | "Carte",
  repairs: Array<{ repairId: number }> = [],
  cashReceived?: number | null
): Promise<Sale> {
  return handleResponse<Sale>(await fetch(`${API_URL}/sales`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items, repairs, paymentMethod, cashReceived }),
  }));
}

export async function getSales(): Promise<SaleSummary[]> {
  return handleResponse<SaleSummary[]>(await fetch(`${API_URL}/sales`));
}

export async function getSaleById(id: number): Promise<Sale> {
  return handleResponse<Sale>(await fetch(`${API_URL}/sales/${id}`));
}

export async function cancelSale(id: number, reason: string): Promise<{ message: string }> {
  return handleResponse(await fetch(`${API_URL}/sales/${id}/cancel`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }),
  }));
}

export async function createSaleReturn(
  id: number,
  items: Array<{ saleItemId: number; quantity: number }>,
  paymentMethod: "Espèces" | "Carte",
  reason: string
) {
  return handleResponse(await fetch(`${API_URL}/sales/${id}/returns`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, paymentMethod, reason }),
  }));
}

export async function getRepairs(): Promise<Repair[]> {
  return handleResponse<Repair[]>(await fetch(`${API_URL}/repairs`));
}

export async function getReadyRepairs(): Promise<Repair[]> {
  return handleResponse<Repair[]>(await fetch(`${API_URL}/repairs/ready-for-sale`));
}

export async function createRepair(input: {
  clientName: string; phone: string; brand: string; model: string; serialNumber: string;
  problem: string; receptionCondition: string; accessories: string;
  serviceCategory?: string; serviceName?: string; servicePriceHint?: string;
}): Promise<Repair> {
  return handleResponse<Repair>(await fetch(`${API_URL}/repairs`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function createQuickRepair(input: {
  clientName: string; phone: string; brand: string; model: string; problem: string;
  repairDetails: string; partsCost: number; laborCost: number;
  serviceCategory?: string; serviceName?: string; servicePriceHint?: string;
}): Promise<Repair> {
  return handleResponse<Repair>(await fetch(`${API_URL}/repairs/quick`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export async function updateRepairStatus(id: number, status: string): Promise<Repair> {
  return handleResponse<Repair>(await fetch(`${API_URL}/repairs/${id}/status`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
  }));
}

export async function prepareRepair(id: number, input: { diagnosis: string; repairDetails: string; partsCost: number; laborCost: number; }): Promise<Repair> {
  return handleResponse<Repair>(await fetch(`${API_URL}/repairs/${id}/prepare`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
  }));
}

export type BackupFile = { filename: string; size: number; createdAt: string; };
export async function getBackups(): Promise<BackupFile[]> { return handleResponse<BackupFile[]>(await fetch(`${API_URL}/backups`)); }
export async function createBackup(): Promise<{ message: string; filename: string }> { return handleResponse(await fetch(`${API_URL}/backups`, { method: "POST" })); }
export function backupDownloadUrl(filename: string) { return `${API_URL}/backups/${encodeURIComponent(filename)}/download`; }
