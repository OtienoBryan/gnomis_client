import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Download } from 'lucide-react';

interface ProductSaleData {
  id: number;
  product_name: string;
  product_code: string;
  category_name: string;
  total_quantity: number;
  total_amount: number;
  total_orders: number;
  average_price: number;
}

interface FilterState {
  startDate: string;
  endDate: string;
  category: string;
  searchQuery: string;
}

const ProductsSaleReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductSaleData[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductSaleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  
  // Get first and last day of current month, using local date parts (toISOString()
  // converts to UTC first, which rolls the 1st back to the previous month in
  // timezones ahead of UTC)
  const toLocalISODate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const today = new Date();
  const firstDayOfMonth = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDayOfMonth = toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const [filters, setFilters] = useState<FilterState>({
    startDate: firstDayOfMonth,
    endDate: lastDayOfMonth,
    category: '',
    searchQuery: ''
  });

  // For modal temp state
  const [tempFilters, setTempFilters] = useState<FilterState>(filters);

  useEffect(() => {
    fetchProductsSaleData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [products, filters]);

  const fetchProductsSaleData = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching products sale data...');
      console.log('Date range:', filters.startDate, 'to', filters.endDate);
      
      const params = new URLSearchParams({
        startDate: filters.startDate,
        endDate: filters.endDate
      });

      const url = `/api/financial/products-sale-report?${params}`;
      console.log('API URL:', url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch products sale data`);
      }
      
      const data = await response.json();
      console.log('Products sale data received:', data);
      
      if (data.success) {
        console.log('Products data:', data.data);
        console.log('Number of products:', data.data?.length || 0);
        setProducts(data.data || []);
        
        // Extract unique categories for filter
        const uniqueCategories = Array.from(new Set(data.data.map((p: ProductSaleData) => p.category_name).filter(Boolean))) as string[];
        setCategories(uniqueCategories);
        console.log('Unique categories:', uniqueCategories);
      } else {
        throw new Error(data.error || 'Failed to fetch products sale data');
      }
    } catch (err: any) {
      console.error('Error fetching products sale data:', err);
      setError(err.message || 'Failed to fetch products sale data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...products];

    // Apply search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.product_name.toLowerCase().includes(query) ||
        product.product_code.toLowerCase().includes(query) ||
        product.category_name.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(product => product.category_name === filters.category);
    }

    setFilteredProducts(filtered);
  };

  const openFilterModal = () => {
    setTempFilters(filters);
    setShowFilterModal(true);
  };

  const closeFilterModal = () => setShowFilterModal(false);

  const applyFilterChanges = () => {
    setFilters(tempFilters);
    setShowFilterModal(false);
    fetchProductsSaleData(); // Refetch data with new date filters
  };

  const resetFilters = () => {
    const resetFilters: FilterState = {
      startDate: firstDayOfMonth,
      endDate: lastDayOfMonth,
      category: '',
      searchQuery: ''
    };
    setFilters(resetFilters);
    setTempFilters(resetFilters);
    setShowFilterModal(false);
    fetchProductsSaleData();
  };

  const exportToCSV = async () => {
    if (exporting) return;
    
    try {
      setExporting(true);
      
      const headers = [
        'Product Name', 
        'Product Code', 
        'Category', 
        'Total Quantity Sold', 
        'Total Amount', 
        'Total Orders', 
        'Average Price'
      ];
      
      const csvData = filteredProducts.map(product => [
        product.product_name,
        product.product_code,
        product.category_name,
        product.total_quantity,
        product.total_amount.toFixed(2),
        product.total_orders,
        product.average_price.toFixed(2)
      ]);

      const csvContent = [headers, ...csvData]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filterInfo = [];
      if (filters.startDate !== firstDayOfMonth) filterInfo.push(`From-${filters.startDate}`);
      if (filters.endDate !== lastDayOfMonth) filterInfo.push(`To-${filters.endDate}`);
      if (filters.category) filterInfo.push(`Category-${filters.category}`);
      
      const filterSuffix = filterInfo.length > 0 ? `-${filterInfo.join('-')}` : '';
      a.download = `products-sale-report-${dateStr}${filterSuffix}.csv`;
      
      a.click();
      window.URL.revokeObjectURL(url);
      
      console.log('CSV exported successfully');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'KES' 
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-3 text-xs text-gray-600">Loading products sale data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xs font-semibold text-red-600">Error</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchProductsSaleData}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalQuantity = filteredProducts.reduce((sum, p) => sum + Number(p.total_quantity), 0);
  const totalOrders = filteredProducts.reduce((sum, p) => sum + Number(p.total_orders), 0);
  const totalRevenue = filteredProducts.reduce((sum, p) => sum + Number(p.total_amount), 0);
  const activeFilterCount = [
    filters.startDate !== firstDayOfMonth,
    filters.endDate !== lastDayOfMonth,
    filters.category !== ''
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-8xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
            <div>
              <h1 className="text-sm font-bold text-gray-900">Products Sale Report</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Products sold from {formatDate(filters.startDate)} to {formatDate(filters.endDate)}
              </p>
            </div>
            <button
              onClick={exportToCSV}
              disabled={exporting || filteredProducts.length === 0}
              className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exporting ? (
                <>
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-3 w-3" />
                  Export CSV
                </>
              )}
            </button>
          </div>
        </div>

        {/* Summary Stats - no icons, clean number-forward cards */}
        {filteredProducts.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3">
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Products</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(filteredProducts.length)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Quantity Sold</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(totalQuantity)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Orders</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(totalOrders)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Total Revenue</p>
              <p className="text-sm font-bold text-orange-600 mt-0.5">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
                className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                placeholder="Search products by name, code, or category..."
              />
            </div>
            <button
              type="button"
              onClick={openFilterModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
            >
              <Filter className="h-3 w-3" />
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-600 text-white text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-900">
              Products ({filteredProducts.length})
            </h3>
          </div>
          {filteredProducts.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-medium text-gray-700">No products found</p>
              <p className="text-[10px] text-gray-500 mt-1">No products were sold in the selected date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Product</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Qty Sold</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Avg Price</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredProducts.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => navigate(`/products-sale-report/${product.id}?startDate=${filters.startDate}&endDate=${filters.endDate}`)}
                      className="cursor-pointer hover:bg-red-50"
                    >
                      <td className="px-3 py-2">
                        <div className="text-xs font-medium text-gray-900">{product.product_name}</div>
                        <div className="text-[10px] text-gray-500">{product.product_code}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-700">
                          {product.category_name || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-900">
                        {formatNumber(product.total_quantity)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatNumber(product.total_orders)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatCurrency(product.average_price)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-gray-900">
                        {formatCurrency(product.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={2} className="px-3 py-2 text-[10px] font-semibold text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">{formatNumber(totalQuantity)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">{formatNumber(totalOrders)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-orange-600">{formatCurrency(totalRevenue)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-md shadow-xl p-4 w-full max-w-sm mx-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-900">Filter Products</h2>
              <button
                onClick={closeFilterModal}
                className="text-gray-400 hover:text-gray-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={tempFilters.startDate}
                  onChange={e => setTempFilters({ ...tempFilters, startDate: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={tempFilters.endDate}
                  onChange={e => setTempFilters({ ...tempFilters, endDate: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={tempFilters.category}
                  onChange={e => setTempFilters({ ...tempFilters, category: e.target.value })}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={resetFilters}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Reset
              </button>
              <button
                onClick={closeFilterModal}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={applyFilterChanges}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductsSaleReportPage; 