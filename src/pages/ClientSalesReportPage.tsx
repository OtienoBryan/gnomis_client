import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Filter } from 'lucide-react';

interface ClientSales {
  client_id: number;
  client_name: string;
  total_orders: number;
  total_subtotal: number;
  total_tax: number;
  total_amount: number;
}

const ClientSalesReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get first and last day of current month as defaults, using local date parts
  // (toISOString() converts to UTC first, which rolls the 1st back to the previous
  // month in timezones ahead of UTC)
  const toLocalISODate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  const today = new Date();
  const firstDayOfMonth = toLocalISODate(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDayOfMonth = toLocalISODate(new Date(today.getFullYear(), today.getMonth() + 1, 0));

  const [startDate, setStartDate] = useState(firstDayOfMonth);
  const [endDate, setEndDate] = useState(lastDayOfMonth);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  useEffect(() => {
    fetchClientSales();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const fetchClientSales = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(`/api/financial/sales-report/clients?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch client sales report`);
      }

      const data = await response.json();
      if (data.success) {
        setClients(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch client sales report');
      }
    } catch (err: any) {
      console.error('Error fetching client sales report:', err);
      setError(err.message || 'Failed to fetch client sales report');
    } finally {
      setLoading(false);
    }
  };

  const openFilterModal = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setShowFilterModal(true);
  };

  const applyFilterChanges = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    setTempStartDate(firstDayOfMonth);
    setTempEndDate(lastDayOfMonth);
    setStartDate(firstDayOfMonth);
    setEndDate(lastDayOfMonth);
    setShowFilterModal(false);
  };

  const filteredClients = clients.filter(c =>
    c.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(Number(amount));

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(Number(num));

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-3 text-xs text-gray-600">Loading client sales report...</p>
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
            onClick={fetchClientSales}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalOrders = filteredClients.reduce((sum, c) => sum + Number(c.total_orders), 0);
  const totalAmount = filteredClients.reduce((sum, c) => sum + Number(c.total_amount), 0);
  const activeFilterCount = [startDate !== firstDayOfMonth, endDate !== lastDayOfMonth].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-8xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-red-50 flex items-center justify-center">
              <Users className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Client Sales Report</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Confirmed sales by client from {formatDate(startDate)} to {formatDate(endDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {filteredClients.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Clients</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(filteredClients.length)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Orders</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(totalOrders)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Total Sales</p>
              <p className="text-sm font-bold text-orange-600 mt-0.5">{formatCurrency(totalAmount)}</p>
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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                placeholder="Search clients by name..."
              />
            </div>
            <button
              type="button"
              onClick={openFilterModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50"
            >
              <Filter className="h-3 w-3" />
              Date Filter
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-600 text-white text-[9px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Clients Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">Clients ({filteredClients.length})</h3>
          </div>
          {filteredClients.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-medium text-gray-700">No clients found</p>
              <p className="text-[10px] text-gray-500 mt-1">No confirmed sales in the selected date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Net Sales</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Tax</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredClients.map((client) => (
                    <tr
                      key={client.client_id}
                      onClick={() => navigate(`/reports/client-sales/${client.client_id}?startDate=${startDate}&endDate=${endDate}`)}
                      className="cursor-pointer hover:bg-red-50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {client.client_name}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-900">
                        {formatNumber(client.total_orders)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatCurrency(client.total_subtotal)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatCurrency(client.total_tax)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-gray-900">
                        {formatCurrency(client.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-3 py-2 text-[10px] font-semibold text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">{formatNumber(totalOrders)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-orange-600">{formatCurrency(totalAmount)}</td>
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
              <h2 className="text-xs font-semibold text-gray-900">Filter by Date</h2>
              <button
                onClick={() => setShowFilterModal(false)}
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
                  value={tempStartDate}
                  onChange={e => setTempStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={e => setTempEndDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                />
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
                onClick={() => setShowFilterModal(false)}
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

export default ClientSalesReportPage;
