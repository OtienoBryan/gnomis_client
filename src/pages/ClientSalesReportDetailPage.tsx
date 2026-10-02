import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Filter } from 'lucide-react';

interface ClientSalesOrder {
  order_id: number;
  so_number: string;
  order_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
}

interface ClientInfo {
  id: number;
  name: string;
}

const ClientSalesReportDetailPage: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [client, setClient] = useState<ClientInfo | null>(null);
  const [orders, setOrders] = useState<ClientSalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState(searchParams.get('startDate') || '');
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || '');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(startDate);
  const [tempEndDate, setTempEndDate] = useState(endDate);

  useEffect(() => {
    if (clientId) {
      fetchDetails(clientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, startDate, endDate]);

  const openFilterModal = () => {
    setTempStartDate(startDate);
    setTempEndDate(endDate);
    setShowFilterModal(true);
  };

  const applyFilterChanges = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);
    const params: Record<string, string> = {};
    if (tempStartDate) params.startDate = tempStartDate;
    if (tempEndDate) params.endDate = tempEndDate;
    setSearchParams(params);
    setShowFilterModal(false);
  };

  const clearFilter = () => {
    setTempStartDate('');
    setTempEndDate('');
    setStartDate('');
    setEndDate('');
    setSearchParams({});
    setShowFilterModal(false);
  };

  const fetchDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/financial/sales-report/clients/${id}?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch client sales`);
      }

      const data = await response.json();
      if (data.success) {
        setClient(data.client);
        setOrders(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch client sales');
      }
    } catch (err: any) {
      console.error('Error fetching client sales report detail:', err);
      setError(err.message || 'Failed to fetch client sales');
    } finally {
      setLoading(false);
    }
  };

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
          <p className="mt-3 text-xs text-gray-600">Loading client sales...</p>
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
            onClick={() => clientId && fetchDetails(clientId)}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalAmount = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-8xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="mb-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-red-600 hover:text-red-700 mb-2.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Back</span>
          </button>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="flex items-center justify-between gap-2.5">
              <div>
                <h1 className="text-sm font-bold text-gray-900">{client?.name || 'Client'}</h1>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {(startDate || endDate) ? (
                    <>Sales from {formatDate(startDate)} to {formatDate(endDate)}</>
                  ) : (
                    'All confirmed sales'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={openFilterModal}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-white text-gray-700 hover:bg-gray-50 flex-shrink-0"
              >
                <Filter className="h-3 w-3" />
                Date Filter
                {(startDate || endDate) && (
                  <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-600 text-white text-[9px] font-bold">
                    1
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 mb-3">
          <div className="bg-white border border-gray-200 rounded-md p-2.5">
            <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Orders</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(orders.length)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-2.5">
            <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Total Sales</p>
            <p className="text-sm font-bold text-orange-600 mt-0.5">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">Sales ({orders.length})</h3>
          </div>
          {orders.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-medium text-gray-700">No sales found</p>
              <p className="text-[10px] text-gray-500 mt-1">This client had no confirmed sales in the selected date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Order #</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Net</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Tax</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {orders.map((order) => (
                    <tr
                      key={order.order_id}
                      onClick={() => navigate(`/sales-order-invoice/${order.order_id}`)}
                      className="cursor-pointer hover:bg-red-50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {order.so_number}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {formatDate(order.order_date)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-gray-100 text-gray-700 capitalize">
                          {order.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatCurrency(order.subtotal)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatCurrency(order.tax_amount)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-[10px] font-semibold text-gray-700">Total</td>
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
                onClick={clearFilter}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                Clear
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

export default ClientSalesReportDetailPage;
