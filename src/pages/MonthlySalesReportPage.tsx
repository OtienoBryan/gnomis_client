import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, LineChart } from 'lucide-react';

interface MonthlySales {
  month_key: string;
  month_label: string;
  total_orders: number;
  total_subtotal: number;
  total_tax: number;
  total_amount: number;
}

const MonthlySalesReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [months, setMonths] = useState<MonthlySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMonthlySales();
  }, []);

  const fetchMonthlySales = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/financial/sales-report/monthly', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch monthly sales report`);
      }

      const data = await response.json();
      if (data.success) {
        setMonths(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch monthly sales report');
      }
    } catch (err: any) {
      console.error('Error fetching monthly sales report:', err);
      setError(err.message || 'Failed to fetch monthly sales report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(Number(amount));

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(Number(num));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-3 text-xs text-gray-600">Loading sales report...</p>
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
            onClick={fetchMonthlySales}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalOrders = months.reduce((sum, m) => sum + Number(m.total_orders), 0);
  const totalAmount = months.reduce((sum, m) => sum + Number(m.total_amount), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-8xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-md bg-red-50 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900">Sales Report</h1>
                <p className="text-[10px] text-gray-500">Confirmed sales summarized by month</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/reports/client-sales')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-50"
              >
                By Client
              </button>
              <button
                onClick={() => navigate('/reports/monthly-sales/graph')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-md hover:bg-orange-700"
              >
                <LineChart className="h-3 w-3" />
                View Graph
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {months.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Months</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(months.length)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Total Orders</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(totalOrders)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-2.5">
              <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Total Sales</p>
              <p className="text-sm font-bold text-orange-600 mt-0.5">{formatCurrency(totalAmount)}</p>
            </div>
          </div>
        )}

        {/* Monthly Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">Monthly Summary ({months.length})</h3>
          </div>
          {months.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-medium text-gray-700">No sales found</p>
              <p className="text-[10px] text-gray-500 mt-1">No confirmed sales orders have been recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Net Sales</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Tax</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Sales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {months.map((m) => (
                    <tr
                      key={m.month_key}
                      onClick={() => navigate(`/reports/monthly-sales/${m.month_key}`)}
                      className="cursor-pointer hover:bg-red-50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {m.month_label}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-900">
                        {formatNumber(m.total_orders)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatCurrency(m.total_subtotal)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatCurrency(m.total_tax)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-gray-900">
                        {formatCurrency(m.total_amount)}
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
    </div>
  );
};

export default MonthlySalesReportPage;
