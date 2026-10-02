import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { StoreInventory, StoreInventorySummary, Product } from '../types/financial';
import { inventoryAsOfService, categoriesService, productsService } from '../services/financialService';

const StoreInventoryPage: React.FC = () => {
  const [inventorySummary, setInventorySummary] = useState<StoreInventorySummary[]>([]);
  const [allInventory, setAllInventory] = useState<StoreInventory[]>([]);
  const selectedStore = 'all' as number | 'all';
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [stores, setStores] = useState<{ id: number; store_name: string; store_code: string }[]>([]);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [asOfInventory, setAsOfInventory] = useState<any[] | null>(null);
  const [stockSummaryData, setStockSummaryData] = useState<any>(null);
  const [stockSummaryCategoryFilter, setStockSummaryCategoryFilter] = useState<string>('all');
  const [showStoreOverview, setShowStoreOverview] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(20);
  const [sortField, setSortField] = useState<string>('category');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [inTransitProducts, setInTransitProducts] = useState<any[]>([]);
  const [search, setSearch] = useState<string>('');
  const [lowOnly, setLowOnly] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (allInventory.length > 0 && stores.length > 0) {
      console.log('stores:', stores);
      console.log('allInventory:', allInventory);
      allInventory.forEach(item => {
        const found = stores.find(s => Number(s.id) === Number(item.store_id));
        if (!found) {
          console.log('No match for store_id:', item.store_id);
        }
      });
    }
  }, [stores, allInventory]);

  useEffect(() => {
    if (selectedDate) {
      fetchInventoryAsOf(selectedDate, selectedStore);
    } else {
      setAsOfInventory(null);
    }
  }, [selectedDate, selectedStore]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStore, selectedCategory, selectedDate, search, lowOnly]);

  // Reset to first page when sorting changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortField, sortDirection]);

  const fetchInventoryAsOf = async (date: string, store: number | 'all') => {
    try {
      const params: any = { date };
      if (store !== 'all') params.store_id = store;
      const response = await inventoryAsOfService.getAll(params);
      if (response.success && response.data) {
        setAsOfInventory(response.data);
      } else {
        setAsOfInventory([]);
      }
    } catch {
      setAsOfInventory([]);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch inventory summary
      const summaryResponse = await storeService.getInventorySummaryByStore();
      if (summaryResponse.success) {
        setInventorySummary(summaryResponse.data || []);
      }

      // Fetch all stores
      const storesResponse = await storeService.getAllStores();
      if (storesResponse.success) {
        setStores(storesResponse.data || []);
      }

      // Fetch all inventory
      const inventoryResponse = await storeService.getAllStoresInventory();
      if (inventoryResponse.success) {
        setAllInventory(inventoryResponse.data || []);
      }

      // Fetch all categories
      const categoriesResponse = await categoriesService.getAll();
      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data || []);
      }

      // Fetch all products
      const productsResponse = await productsService.getAll();
      if (productsResponse.success) {
        setProducts(productsResponse.data || []);
      }

      // Fetch stock summary data
      const stockSummaryResponse = await storeService.getStockSummary();
      if (stockSummaryResponse.success) {
        setStockSummaryData(stockSummaryResponse.data);
      }

      // Fetch in-transit products
      const inTransitResponse = await storeService.getInTransitProducts();
      if (inTransitResponse.success) {
        setInTransitProducts(inTransitResponse.data || []);
      }
    } catch (err) {
      setError('Failed to fetch inventory data');
    } finally {
      setLoading(false);
    }
  };

  // One row per product: its quantity in each store (by_store), plus the total across stores
  const getFilteredInventory = () => {
    let rows: any[] = asOfInventory || allInventory;

    if (selectedCategory !== 'all') {
      rows = rows.filter(item => item.category === selectedCategory);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(item => (item.product_name || '').toLowerCase().includes(q));
    }

    const byProduct = new Map<number, any>();
    rows.forEach(item => {
      const key = Number(item.product_id);
      let row = byProduct.get(key);
      if (!row) {
        row = {
          product_id: key,
          product_name: item.product_name,
          category: item.category,
          unit_of_measure: item.unit_of_measure,
          cost_price: item.cost_price,
          target_stock_qty: item.target_stock_qty,
          quantity: 0,
          inventory_value: 0,
          by_store: {} as Record<number, number>,
        };
        byProduct.set(key, row);
      }
      const qty = Number(item.quantity) || 0;
      row.quantity += qty;
      row.inventory_value += Number(item.inventory_value) || 0;
      row.by_store[Number(item.store_id)] = (row.by_store[Number(item.store_id)] || 0) + qty;
    });

    let result = Array.from(byProduct.values());
    if (lowOnly) {
      result = result.filter(r => r.quantity <= 10);
    }

    result.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      if (aValue === null || aValue === undefined) aValue = '';
      if (bValue === null || bValue === undefined) bValue = '';
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  };

  const getFilteredStockSummary = () => {
    if (!stockSummaryData || !stockSummaryData.products) {
      return [];
    }
    
    if (stockSummaryCategoryFilter === 'all') {
      return stockSummaryData.products;
    }
    
    return stockSummaryData.products.filter((product: any) => 
      product.category === stockSummaryCategoryFilter
    );
  };

  const getInTransitQuantity = (productId: number) => {
    const inTransitProduct = inTransitProducts.find(item => item.product_id === productId);
    return inTransitProduct ? inTransitProduct.in_transit_quantity : 0;
  };

  const number_format = (amount: number) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0.00';
    }
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getLowStockItems = () => {
    return getFilteredInventory().filter(item => item.quantity <= 10);
  };

  const getTotalInventoryValue = () => {
    return getFilteredInventory().reduce((total, item) => {
      return total + (Number(item.inventory_value) || 0);
    }, 0);
  };

  const getTotalItems = () => {
    return getFilteredInventory().reduce((total, item) => {
      return total + (Number(item.quantity) || 0);
    }, 0);
  };

  const getTotalProducts = () => {
    return new Set(getFilteredInventory().map(item => item.product_id)).size;
  };

  // Pagination functions
  const getPaginatedInventory = () => {
    const filtered = getFilteredInventory();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(getFilteredInventory().length / itemsPerPage);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < getTotalPages()) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-3"></div>
          <p className="text-xs text-gray-600 font-medium">Loading inventory data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 shadow-lg">
            <div className="flex items-center">
              <div className="p-1.5 bg-red-100 rounded-xl mr-3">
                <svg className="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xs font-semibold text-red-800">Error Loading Data</h3>
                <div className="mt-0.5 text-xs text-red-700">{error}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredInventory = getFilteredInventory();
  const paginatedInventory = getPaginatedInventory();
  const lowStockItems = getLowStockItems();
  const totalPages = getTotalPages();
  const storeColumns = stores.filter(st => (asOfInventory || allInventory).some(i => Number(i.store_id) === Number(st.id)));
  const money = (n: number | string | null | undefined) =>
    Number(n || 0).toLocaleString(undefined, { style: 'currency', currency: 'KES' });
  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  const sortHeader = (field: string, label: string, align: 'left' | 'right' = 'left') => (
    <th
      className={`${th} cursor-pointer select-none hover:text-gray-800 ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(field)}
    >
      {label}
      <span className={`ml-1 ${sortField === field ? 'text-red-600' : 'text-gray-300'}`}>
        {sortField === field ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </th>
  );

  const actionLink =
    'px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50';

  const fieldClass =
    'border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

  const stat = (label: string, value: string, hint: string, valueClass = 'text-gray-900', onClick?: () => void, active = false) => (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-sm border p-4 min-w-0 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${
        active ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-100'
      }`}
    >
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold truncate ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  );

  const from = filteredInventory.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const to = Math.min(currentPage * itemsPerPage, filteredInventory.length);

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-5">
        {/* Header */}
        <div className="mb-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Store Inventory</h1>
            <p className="text-xs text-gray-500 mt-0.5">Stock levels, cost and value of your products across stores.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/receive-products" className="px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700">
              Receive Products
            </Link>
            <Link to="/receiving-history" className={actionLink}>Receiving History</Link>
            <Link to="/update-stock-quantity" className={actionLink}>Update Stock</Link>
            <Link to="/stock-transfer" className={actionLink}>Stock Transfer</Link>
            <Link to="/stock-take" className={actionLink}>Stock Take</Link>
            <Link to="/inventory-transactions" className={actionLink}>Transactions</Link>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {stat('Total Products', getTotalProducts().toLocaleString(), 'Across all stores')}
          {stat('Total Items', getTotalItems().toLocaleString(), 'Units in stock', 'text-emerald-600')}
          {stat('Total Value', money(getTotalInventoryValue()), 'At cost price', 'text-purple-600')}
          {stat(
            'Low Stock',
            lowStockItems.length.toLocaleString(),
            lowOnly ? 'Showing low stock only' : 'Click to show only these',
            'text-red-600',
            () => setLowOnly(v => !v),
            lowOnly
          )}
        </div>

        {/* Table panel */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-end gap-3">
            <input
              className={`${fieldClass} w-56`}
              placeholder="Search products..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select className={fieldClass} value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-0.5">As of date</label>
              <input
                type="date"
                className={fieldClass}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
            {(search || selectedCategory !== 'all' || selectedDate || lowOnly) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedCategory('all');
                  setSelectedDate('');
                  setLowOnly(false);
                }}
                className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800"
              >
                Clear filters
              </button>
            )}
            <div className="ml-auto flex items-center gap-3">
              {inventorySummary.length > 0 && (
                <button type="button" onClick={() => setShowStoreOverview(true)} className={actionLink}>
                  Store Overview
                </button>
              )}
              <span className="text-[11px] text-gray-500">
                {from}-{to} of {filteredInventory.length}
              </span>
            </div>
          </div>

          {filteredInventory.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm font-medium text-gray-700">No inventory found</p>
              <p className="text-xs text-gray-400 mt-1">Try clearing the filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {sortHeader('product_name', 'Product')}
                    {sortHeader('category', 'Category')}
                    {storeColumns.map(st => (
                      <th key={st.id} className={`${th} text-right`}>{st.store_name}</th>
                    ))}
                    {sortHeader('quantity', 'Total', 'right')}
                    <th className={`${th} text-right`}>Target Qty</th>
                    <th className={`${th} text-right`}>In Transit</th>
                    <th className={`${th} text-left`}>Unit</th>
                    <th className={`${th} text-right`}>Cost Price</th>
                    {sortHeader('inventory_value', 'Value', 'right')}
                    <th className={`${th} text-right`}>Ledger</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedInventory.map(item => {
                    const quantity = Number(item.quantity) || 0;
                    const target = Number(item.target_stock_qty) || 0;
                    const shortfall = target - quantity;
                    const inTransitQty = getInTransitQuantity(item.product_id);
                    return (
                      <tr key={item.product_id} className="hover:bg-gray-50/70">
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{item.product_name}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700">
                            {item.category || 'N/A'}
                          </span>
                        </td>
                        {storeColumns.map(st => {
                          const qty = Number(item.by_store[Number(st.id)] || 0);
                          return (
                            <td key={st.id} className={`px-4 py-2.5 whitespace-nowrap text-right text-xs ${qty ? 'text-gray-900' : 'text-gray-300'}`}>
                              {qty ? qty.toLocaleString() : '—'}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              quantity <= 10
                                ? 'bg-red-100 text-red-700'
                                : quantity <= 50
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {quantity.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                          {target <= 0 ? (
                            <span className="text-xs text-gray-300">—</span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="text-xs text-gray-900">{target.toLocaleString()}</span>
                              {shortfall > 0 && (
                                <span
                                  title={`Below target by ${shortfall.toLocaleString()}`}
                                  className="inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700"
                                >
                                  Below by {shortfall.toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                          {inTransitQty > 0 ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                              {inTransitQty.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600">{item.unit_of_measure}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right text-xs text-gray-700">
                          {item.cost_price ? Number(item.cost_price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right text-xs font-semibold text-gray-900">
                          {money(item.inventory_value)}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                          <Link
                            to={`/inventory-transactions?product=${item.product_id}`}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                          >
                            View Ledger
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filteredInventory.length > itemsPerPage && (
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[11px] text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) pageNum = i + 1;
                  else if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${
                        currentPage === pageNum ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Store Overview Modal */}
      {showStoreOverview && (() => {
        const overview = [...inventorySummary].sort(
          (x, y) => Number(y.total_inventory_value || 0) - Number(x.total_inventory_value || 0)
        );
        const sum = overview.reduce(
          (acc, st) => ({
            products: acc.products + Number(st.total_products || 0),
            items: acc.items + Number(st.total_items || 0),
            value: acc.value + Number(st.total_inventory_value || 0),
          }),
          { products: 0, items: 0, value: 0 }
        );
        const oth = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';
        return (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowStoreOverview(false)}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Store Overview</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Stock and value held in each store, highest value first.</p>
                </div>
                <button
                  onClick={() => setShowStoreOverview(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="px-6 py-4 overflow-y-auto space-y-4">
                {/* Totals across all stores */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ['Stores', overview.length.toLocaleString(), 'text-gray-900'],
                    ['Products', sum.products.toLocaleString(), 'text-gray-900'],
                    ['Items in stock', sum.items.toLocaleString(), 'text-emerald-600'],
                    ['Total value', money(sum.value), 'text-purple-600'],
                  ].map(([label, value, color]) => (
                    <div key={label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
                      <p className={`text-sm font-bold truncate ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Per store */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className={`${oth} text-left`}>Store</th>
                        <th className={`${oth} text-right`}>Products</th>
                        <th className={`${oth} text-right`}>Items</th>
                        <th className={`${oth} text-right`}>Value</th>
                        <th className={`${oth} text-right`}>Share</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {overview.map(store => {
                        const value = Number(store.total_inventory_value || 0);
                        const share = sum.value > 0 ? (value / sum.value) * 100 : 0;
                        return (
                          <tr key={store.id} className="hover:bg-gray-50/70">
                            <td className="px-4 py-2.5 whitespace-nowrap">
                              <div className="text-xs font-semibold text-gray-900">{store.store_name}</div>
                              <div className="text-[10px] text-gray-400">{store.store_code}</div>
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-700">{Number(store.total_products || 0).toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-700">{Number(store.total_items || 0).toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-semibold text-gray-900">{money(value)}</td>
                            <td className="px-4 py-2.5 text-right text-xs text-gray-500">{share.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-4 py-2.5 text-[11px] font-semibold text-gray-600 text-right">Total</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{sum.products.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{sum.items.toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{money(sum.value)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex justify-end px-6 py-3 border-t border-gray-100">
                <button
                  onClick={() => setShowStoreOverview(false)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default StoreInventoryPage;
