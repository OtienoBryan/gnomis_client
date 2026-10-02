import api from './api';
import { 
  Store, 
  StoreInventory, 
  StoreInventorySummary, 
  InventoryReceipt,
  ApiResponse 
} from '../types/financial';

export interface StockSummaryData {
  stores: Store[];
  products: {
    id: number;
    product_name: string;
    product_code: string;
    category?: string;
    reorder_level?: number;
    store_quantities: { [storeId: number]: number };
  }[];
}

export const storeService = {
  // Get all stores
  getAllStores: async (): Promise<ApiResponse<Store[]>> => {
    const response = await api.get('/financial/stores');
    return response.data;
  },

  // Get store by ID
  getStoreById: async (id: number): Promise<ApiResponse<Store>> => {
    const response = await api.get(`/financial/stores/${id}`);
    return response.data;
  },

  // Get store inventory
  getStoreInventory: async (storeId: number): Promise<ApiResponse<StoreInventory[]>> => {
    const response = await api.get(`/financial/stores/${storeId}/inventory`);
    return response.data;
  },

  // Get all stores inventory
  getAllStoresInventory: async (): Promise<ApiResponse<StoreInventory[]>> => {
    const response = await api.get('/financial/stores-inventory');
    return response.data;
  },

  // Get inventory summary by store
  getInventorySummaryByStore: async (): Promise<ApiResponse<StoreInventorySummary[]>> => {
    const response = await api.get('/financial/inventory-summary');
    return response.data;
  },

  // Get stock summary for all products across all stores
  getStockSummary: async (): Promise<ApiResponse<StockSummaryData>> => {
    const response = await api.get('/financial/stock-summary');
    return response.data;
  },

  // Get in-transit products
  getInTransitProducts: async (): Promise<ApiResponse<any[]>> => {
    const response = await api.get('/financial/inventory/in-transit');
    return response.data;
  },

  // Update stock quantity
  updateStockQuantity: async (data: {
    store_id: number;
    product_id: number;
    new_quantity: number;
    reason?: string;
    staff_id?: number;
  }): Promise<ApiResponse<any>> => {
    const response = await api.post('/financial/stores/update-stock-quantity', data);
    return response.data;
  },

  // Receive a cart of products into a store (adds to store_inventory and the inventory ledger)
  receiveStock: async (data: {
    store_id: number;
    items: { product_id: number; quantity: number; unit_cost?: number }[];
    staff_id?: number;
    reference?: string;
    notes?: string;
  }): Promise<ApiResponse<any>> => {
    const response = await api.post('/financial/stores/receive-stock', data);
    return response.data;
  },

  // History of stock receipts, and the details of one receipt
  getStockReceipts: async (params?: { store_id?: number; start_date?: string; end_date?: string }): Promise<ApiResponse<any[]>> => {
    const response = await api.get('/financial/stock-receipts', { params });
    return response.data;
  },

  getStockReceipt: async (id: number): Promise<ApiResponse<any>> => {
    const response = await api.get(`/financial/stock-receipts/${id}`);
    return response.data;
  }
}; 