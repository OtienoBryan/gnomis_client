import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface MonthlySalesOrder {
  order_id: number;
  so_number: string;
  order_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  client_id: number;
  client_name: string;
}

const formatMonthLabel = (month: string) => {
  if (!month) return '';
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const MonthlySalesReportDetailPage: React.FC = () => {
  const { month } = useParams<{ month: string }>();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<MonthlySalesOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (month) {
      fetchDetails(month);
    }
  }, [month]);

  const fetchDetails = async (monthKey: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/financial/sales-report/monthly/${monthKey}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch sales for this month`);
      }

      const data = await response.json();
      if (data.success) {
        setOrders(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch sales for this month');
      }
    } catch (err: any) {
      console.error('Error fetching monthly sales detail:', err);
      setError(err.message || 'Failed to fetch sales for this month');
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
          <p className="mt-3 text-xs text-gray-600">Loading sales detail...</p>
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
            onClick={() => month && fetchDetails(month)}
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
            <h1 className="text-sm font-bold text-gray-900">{formatMonthLabel(month || '')}</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Confirmed sales orders for this month</p>
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
            <h3 className="text-xs font-semibold text-gray-900">Orders ({orders.length})</h3>
          </div>
          {orders.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-medium text-gray-700">No orders found</p>
              <p className="text-[10px] text-gray-500 mt-1">No confirmed sales orders for this month.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Order #</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Net</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Tax</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {orders.map((order) => (
                    <tr
                      key={order.order_id}
                      onClick={() => navigate(`/sales-orders/${order.order_id}`)}
                      className="cursor-pointer hover:bg-red-50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {order.so_number}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {order.client_name || `Client ${order.client_id}`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {formatDate(order.order_date)}
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
    </div>
  );
};

export default MonthlySalesReportDetailPage;
