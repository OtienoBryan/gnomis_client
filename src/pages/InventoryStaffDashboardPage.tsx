import React, { useState, useEffect, Fragment, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import {
  X as XIcon,
  Package as PackageIcon,
  AlertCircle as AlertCircleIcon
} from 'lucide-react';
import { storeService } from '../services/storeService';
import { productsService, categoriesService, stockTransferService } from '../services/financialService';
import { creditNoteService } from '../services/creditNoteService';
import { StockSummaryData } from '../services/storeService';
import { StoreInventory, StoreInventorySummary } from '../types/financial';
import { CreditNote } from '../services/creditNoteService';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';

interface InventoryStats {
  totalProducts: number;
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
}

interface SalesSummary {
  totalSales: number;
  totalOrders: number;
  averageOrderValue: number;
  topSellingProducts: Array<{
    product_name: string;
    quantity_sold: number;
    sales_value: number;
  }>;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const InventoryStaffDashboardPage: React.FC = () => {
  const [inventoryStats, setInventoryStats] = useState<InventoryStats>({
    totalProducts: 0,
    totalItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0
  });
  const [salesSummary, setSalesSummary] = useState<SalesSummary>({
    totalSales: 0,
    totalOrders: 0,
    averageOrderValue: 0,
    topSellingProducts: []
  });
  const [storeInventory, setStoreInventory] = useState<StoreInventory[]>([]);
  const [storeSummary, setStoreSummary] = useState<StoreInventorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<number | 'all'>('all');
  const [stores, setStores] = useState<{ id: number; store_name: string; store_code: string }[]>([]);
  const [monthlySalesData, setMonthlySalesData] = useState<any[]>([]);
  const [categoryDistribution, setCategoryDistribution] = useState<any[]>([]);
  const [stockSummaryData, setStockSummaryData] = useState<StockSummaryData | null>(null);
  const [stockSummaryCategoryFilter, setStockSummaryCategoryFilter] = useState<string>('all');
  const [stockSummarySearchTerm, setStockSummarySearchTerm] = useState<string>('');
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [creditNoteStats, setCreditNoteStats] = useState({
    totalCreditNotes: 0,
    pendingReceiving: 0,
    received: 0
  });
  const [approvedOrdersCount, setApprovedOrdersCount] = useState(0);
  const [recentTransfers, setRecentTransfers] = useState<any[]>([]);
  const [lowStockModalOpen, setLowStockModalOpen] = useState(false);
  const [itemsBelowReorderLevel, setItemsBelowReorderLevel] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [
        inventoryResponse,
        salesResponse,
        storesResponse,
        storeSummaryResponse,
        categoriesResponse,
        creditNotesResponse,
        topSellingResponse,
        transfersResponse
      ] = await Promise.all([
        storeService.getAllStoresInventory(),
        axios.get('/api/financial/sales-orders', { params: { include_items: false } }),
        storeService.getAllStores(),
        storeService.getInventorySummaryByStore(),
        categoriesService.getAll(),
        creditNoteService.getAll(),
        axios.get('/api/financial/reports/product-performance').catch(() => ({ data: { success: false, data: [] } })),
        stockTransferService.getHistory({ page: 1, limit: 10 }).catch(() => ({ success: false, data: [] }))
      ]);

      // Process inventory
      if (inventoryResponse.success) {
        const inventory = inventoryResponse.data || [];
        setStoreInventory(inventory);

        const totalProducts = new Set(inventory.map(item => item.product_id)).size;
        const totalItems = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const totalValue = inventory.reduce((sum, item) => sum + (item.inventory_value || 0), 0);
        const lowStockItems = inventory.filter(item => (item.quantity || 0) <= 10).length;
        const outOfStockItems = inventory.filter(item => (item.quantity || 0) === 0).length;

        setInventoryStats({ totalProducts, totalItems, totalValue, lowStockItems, outOfStockItems });

        // Category distribution
        const categoryMap = new Map();
        inventory.forEach(item => {
          const category = item.category || 'Uncategorized';
          categoryMap.set(category, (categoryMap.get(category) || 0) + (item.quantity || 0));
        });
        setCategoryDistribution(Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value })));
      }

      // Sales
      if (salesResponse.data?.success) {
        const orders = salesResponse.data.data || [];
        const totalSales = orders.reduce((sum: number, order: any) => sum + (order.total_amount || 0), 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;
        const approvedOrders = orders.filter((order: any) => order.my_status === 1).length;
        setApprovedOrdersCount(approvedOrders);

        const topSellingProducts = topSellingResponse.data?.success
          ? topSellingResponse.data.data.slice(0, 5).map((item: any) => ({
              product_name: item.product_name,
              quantity_sold: item.total_quantity_sold || 0,
              sales_value: item.total_sales_value || 0
            }))
          : [];

        setSalesSummary({ totalSales, totalOrders, averageOrderValue, topSellingProducts });

        // Monthly sales
        const monthMap = new Map();
        orders.forEach((order: any) => {
          if (order.order_date && order.total_amount) {
            const date = new Date(order.order_date);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            monthMap.set(key, (monthMap.get(key) || 0) + (order.total_amount || 0));
          }
        });

        const monthlyData = Array.from(monthMap.entries())
          .map(([key, value]) => {
            const [year, month] = key.split('-');
            return { month: `${getMonthName(parseInt(month))} ${year}`, sales: value };
          })
          .sort((a, b) => {
            const [aMonth, aYear] = a.month.split(' ');
            const [bMonth, bYear] = b.month.split(' ');
            return (parseInt(aYear) - parseInt(bYear)) || (getMonthIndex(aMonth) - getMonthIndex(bMonth));
          });

        setMonthlySalesData(monthlyData);
      }

      if (storesResponse.success) setStores(storesResponse.data || []);
      if (storeSummaryResponse.success) setStoreSummary(storeSummaryResponse.data || []);
      if (inventoryResponse.success) {
        // Build the stock summary from the inventory rows (same data the
        // /stock-summary endpoint returns) to avoid a second heavy query.
        const storesMap = new Map<number, any>();
        const productsMap = new Map<number, any>();
        (inventoryResponse.data || []).forEach((row: any) => {
          if (!storesMap.has(row.store_id)) {
            storesMap.set(row.store_id, { id: row.store_id, store_name: row.store_name, store_code: row.store_code });
          }
          let product = productsMap.get(row.product_id);
          if (!product) {
            product = {
              id: row.product_id,
              product_name: row.product_name,
              product_code: row.product_code,
              category: row.category,
              reorder_level: row.reorder_level || 0,
              store_quantities: {}
            };
            productsMap.set(row.product_id, product);
          }
          product.store_quantities[row.store_id] = row.quantity;
        });
        const stockSummary: any = {
          stores: Array.from(storesMap.values()),
          products: Array.from(productsMap.values())
        };
        setStockSummaryData(stockSummary);
        
        // Calculate items below reorder level
        if (stockSummary && stockSummary.products) {
          const lowStockItems = stockSummary.products
            .map((product: any) => {
              // Calculate total stock across all stores
              const totalStock = stockSummary.stores.reduce((sum: number, store: any) => {
                return sum + (product.store_quantities[store.id] || 0);
              }, 0);
              
              const reorderLevel = product.reorder_level || 1500;
              
              if (totalStock < reorderLevel) {
                return {
                  ...product,
                  totalStock,
                  reorderLevel,
                  difference: totalStock - reorderLevel
                };
              }
              return null;
            })
            .filter((item: any) => item !== null)
            .sort((a: any, b: any) => a.totalStock - b.totalStock); // Sort by total stock (lowest first)
          
          setItemsBelowReorderLevel(lowStockItems);
        }
      }
      if (categoriesResponse.success) setCategories(categoriesResponse.data || []);

      // Credit notes
      if (creditNotesResponse.success) {
        const notes = creditNotesResponse.data || [];
        setCreditNotes(notes);
        setCreditNoteStats({
          totalCreditNotes: notes.length,
          pendingReceiving: notes.filter(n => n.my_status !== 1).length,
          received: notes.filter(n => n.my_status === 1).length
        });
      }

      if (transfersResponse.success) {
        setRecentTransfers((transfersResponse.data || []).slice(0, 10));
      }
    } catch (err) {
      setError('Failed to fetch dashboard data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (selectedStore !== 'all') {
      fetchStoreSpecificData(selectedStore);
    }
  }, [selectedStore]);

  const fetchStoreSpecificData = async (storeId: number) => {
    try {
      const response = await storeService.getStoreInventory(storeId);
      if (response.success) {
        const inventory = response.data || [];
        const totalProducts = inventory.length;
        const totalItems = inventory.reduce((sum, item) => sum + (item.quantity || 0), 0);
        const totalValue = inventory.reduce((sum, item) => sum + (item.inventory_value || 0), 0);
        const lowStockItems = inventory.filter(item => (item.quantity || 0) <= 10).length;
        const outOfStockItems = inventory.filter(item => (item.quantity || 0) === 0).length;

        setInventoryStats({ totalProducts, totalItems, totalValue, lowStockItems, outOfStockItems });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getMonthName = (m: number) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] || '';
  const getMonthIndex = (name: string) => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(name);

  // Debounced search
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(stockSummarySearchTerm), 300);
    return () => clearTimeout(timer);
  }, [stockSummarySearchTerm]);

  const filteredStockSummary = useMemo(() => {
    if (!stockSummaryData?.products) return [];

    let filtered = stockSummaryData.products;

    if (stockSummaryCategoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === stockSummaryCategoryFilter);
    }

    if (debouncedSearchTerm.trim()) {
      const term = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.product_name?.toLowerCase().includes(term) ||
        p.product_code?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  }, [stockSummaryData, stockSummaryCategoryFilter, debouncedSearchTerm]);

  const getStoreName = useCallback((id: number) => stores.find(s => s.id === id)?.store_name || 'Unknown', [stores]);
  const formatCurrency = useCallback((n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n), []);
  const formatNumber = useCallback((n: number) => n.toLocaleString(), []);
  const formatDate = useCallback((d: string) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-', []);
  const formatTime = useCallback((d: string) => d ? new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '', []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-xs">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="w-full bg-white border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-xs font-semibold text-red-800">Error Loading Dashboard</h3>
              <p className="mt-1 text-[10px] text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-bold text-gray-900">Inventory Staff Dashboard</h1>
                  <p className="mt-0.5 text-[10px] text-gray-500">Manage and monitor inventory across all stores</p>
                </div>
                {itemsBelowReorderLevel.length > 0 && (
                  <button
                    onClick={() => setLowStockModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-red-300 text-red-700 rounded-md hover:bg-red-50 text-[10px] font-semibold transition-colors"
                  >
                    <AlertCircleIcon className="h-3.5 w-3.5" />
                    Low Stock Alert ({itemsBelowReorderLevel.length})
                  </button>
                )}
              </div>

              {/* Stock Summary Table */}
              {selectedStore === 'all' && stockSummaryData && stockSummaryData.products.length > 0 && (
                <div className="mb-4 bg-white rounded-md border border-gray-200 overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-200">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                      <h2 className="text-xs font-bold text-gray-900">Stock Summary Across All Stores</h2>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Search products..."
                            value={stockSummarySearchTerm}
                            onChange={(e) => setStockSummarySearchTerm(e.target.value)}
                            className="w-full pl-7 pr-7 py-1.5 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-red-500 focus:border-red-500"
                          />
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          {stockSummarySearchTerm && (
                            <button onClick={() => setStockSummarySearchTerm('')} className="absolute inset-y-0 right-0 pr-2 flex items-center">
                              <XIcon className="h-3.5 w-3.5 text-gray-400" />
                            </button>
                          )}
                        </div>
                        <select
                          value={stockSummaryCategoryFilter}
                          onChange={(e) => setStockSummaryCategoryFilter(e.target.value)}
                          className="px-2 py-1.5 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-red-500 focus:border-red-500"
                        >
                          <option value="all">All Categories</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] text-gray-500">
                    Showing {filteredStockSummary.length} of {stockSummaryData.products.length} products
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Stock</th>
                          {stockSummaryData.stores.map(store => (
                            <th key={store.id} className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">{store.store_name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {filteredStockSummary.map(product => {
                          const totalStock = stockSummaryData.stores.reduce((sum, store) => sum + (product.store_quantities[store.id] || 0), 0);
                          return (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="sticky left-0 bg-white px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{product.product_name}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 inline-flex text-[9px] font-semibold rounded-full bg-gray-100 text-gray-700">
                                  {product.category || 'Uncategorized'}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">{formatNumber(totalStock)}</td>
                              {stockSummaryData.stores.map(store => {
                                const qty = product.store_quantities[store.id] || 0;
                                return (
                                  <td key={store.id} className="px-3 py-2 whitespace-nowrap text-xs">
                                    <span className={`px-1.5 py-0.5 inline-flex text-[9px] font-semibold rounded-full ${
                                      qty === 0 ? 'bg-red-100 text-red-700' :
                                      qty <= 10 ? 'bg-red-100 text-red-700' :
                                      qty <= 50 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-green-100 text-green-700'
                                    }`}>
                                      {formatNumber(qty)}
                                    </span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Transfers */}
              <div className="bg-white rounded-md border border-gray-200 overflow-hidden hidden">
                <div className="px-3 py-2 border-b border-gray-200 flex justify-between items-center">
                  <div>
                    <h2 className="text-xs font-bold text-gray-900">Recent Transfer Records</h2>
                    <p className="text-[10px] text-gray-500">Latest stock transfers between stores</p>
                  </div>
                  <Link to="/stock-transfer-history" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-[10px] font-semibold">
                    <PackageIcon className="h-3.5 w-3.5" /> View All
                  </Link>
                </div>
                {recentTransfers.length === 0 ? (
                  <div className="text-center py-10">
                    <PackageIcon className="mx-auto h-8 w-8 text-gray-300" />
                    <p className="mt-3 text-xs text-gray-500">No recent transfers</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase">Date & Time</th>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase">From</th>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase">To</th>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase">Product</th>
                          <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase">Qty</th>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase">Staff</th>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase">Ref</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {recentTransfers.map((t: any) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 whitespace-nowrap text-xs">
                              <div className="font-medium">{formatDate(t.transfer_date)}</div>
                              <div className="text-gray-500 text-[10px]">{formatTime(t.transfer_date)}</div>
                            </td>
                            <td className="px-3 py-2 text-xs">{t.from_store_name || '-'}</td>
                            <td className="px-3 py-2 text-xs">{t.to_store_name || '-'}</td>
                            <td className="px-3 py-2 text-xs">
                              <div>{t.product_name}</div>
                              {t.product_code && <div className="text-gray-500 text-[10px]">{t.product_code}</div>}
                            </td>
                            <td className="px-3 py-2 text-xs text-right">
                              <span className="px-1.5 py-0.5 inline-flex text-[9px] font-semibold rounded-full bg-red-100 text-red-700">
                                {t.quantity?.toLocaleString()}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs">{t.staff_name || '-'}</td>
                            <td className="px-3 py-2 text-xs">
                              {t.reference ? <span className="px-1.5 py-0.5 inline-flex text-[9px] rounded-md bg-gray-100">{t.reference}</span> : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

      {/* Low Stock Modal */}
      <Transition.Root show={lowStockModalOpen} as={Fragment}>
        <Dialog as="div" className="fixed z-50 inset-0 overflow-y-auto" onClose={setLowStockModalOpen}>
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
            </Transition.Child>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>

            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <div className="inline-block align-bottom bg-white rounded-md text-left overflow-hidden border border-gray-200 shadow-lg transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
                <div className="bg-white px-4 pt-4 pb-3 sm:p-4 sm:pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-shrink-0 mx-auto flex items-center justify-center h-8 w-8 rounded-full bg-red-100 sm:mx-0">
                        <AlertCircleIcon className="h-4 w-4 text-red-600" aria-hidden="true" />
                      </div>
                      <Dialog.Title as="h3" className="text-xs font-bold text-gray-900">
                        Items Below Reorder Level
                      </Dialog.Title>
                    </div>
                    <button
                      type="button"
                      className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                      onClick={() => setLowStockModalOpen(false)}
                    >
                      <span className="sr-only">Close</span>
                      <XIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2">
                    <p className="text-[10px] text-gray-500 mb-3">
                      The following {itemsBelowReorderLevel.length} item(s) have total stock below their reorder level of 1,500 units.
                    </p>

                    {itemsBelowReorderLevel.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-xs text-gray-500">No items below reorder level</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-96 overflow-y-auto border border-gray-200 rounded-md">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                                Product
                              </th>
                              <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                                Category
                              </th>
                              <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                                Reorder Level
                              </th>
                              <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                                Total Stock
                              </th>
                              <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                                Shortfall
                              </th>
                              <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                                Store Breakdown
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {itemsBelowReorderLevel.map((item: any) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <div className="text-xs font-medium text-gray-900">{item.product_name}</div>
                                  <div className="text-[10px] text-gray-500">{item.product_code}</div>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                  <span className="px-1.5 py-0.5 inline-flex text-[9px] font-semibold rounded-full bg-gray-100 text-gray-700">
                                    {item.category || 'Uncategorized'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-right text-gray-900">
                                  {formatNumber(item.reorderLevel)}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-right">
                                  <span className="font-semibold text-red-600">{formatNumber(item.totalStock)}</span>
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-xs text-right">
                                  <span className="font-semibold text-red-600">
                                    {formatNumber(Math.abs(item.difference))}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-gray-500">
                                  <div className="space-y-0.5">
                                    {stockSummaryData?.stores.map((store: any) => {
                                      const qty = item.store_quantities[store.id] || 0;
                                      return (
                                        <div key={store.id} className="flex items-center justify-between">
                                          <span className="text-[10px]">{store.store_name}:</span>
                                          <span className="text-[10px] font-medium">{formatNumber(qty)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 border-t border-gray-200 px-4 py-2.5 sm:px-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent px-3 py-1.5 bg-red-600 text-xs font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto"
                    onClick={() => setLowStockModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
};

export default InventoryStaffDashboardPage;