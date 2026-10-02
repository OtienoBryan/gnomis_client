import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface ProductSaleDetail {
  order_id: number;
  so_number: string;
  order_date: string;
  client_id: number;
  client_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

interface ProductInfo {
  id: number;
  product_name: string;
  product_code: string;
}

const ProductSaleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [sales, setSales] = useState<ProductSaleDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';

  useEffect(() => {
    if (id) {
      fetchDetails(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, startDate, endDate]);

  const fetchDetails = async (productId: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/financial/products-sale-report/${productId}?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch product sale details`);
      }

      const data = await response.json();
      if (data.success) {
        setProduct(data.product);
        setSales(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to fetch product sale details');
      }
    } catch (err: any) {
      console.error('Error fetching product sale details:', err);
      setError(err.message || 'Failed to fetch product sale details');
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
            onClick={() => id && fetchDetails(id)}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totalQuantity = sales.reduce((sum, s) => sum + Number(s.quantity), 0);
  const totalAmount = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);

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
            <h1 className="text-sm font-bold text-gray-900">{product?.product_name || 'Product'}</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {product?.product_code}
              {(startDate || endDate) && (
                <> &middot; {formatDate(startDate)} to {formatDate(endDate)}</>
              )}
            </p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 mb-3">
          <div className="bg-white border border-gray-200 rounded-md p-2.5">
            <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Sales</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(sales.length)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-2.5">
            <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Quantity Sold</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{formatNumber(totalQuantity)}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-2.5">
            <p className="text-[9px] font-medium text-gray-500 uppercase tracking-wide">Total Amount</p>
            <p className="text-sm font-bold text-orange-600 mt-0.5">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Sales Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">Sales ({sales.length})</h3>
          </div>
          {sales.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-xs font-medium text-gray-700">No sales found</p>
              <p className="text-[10px] text-gray-500 mt-1">This product had no confirmed sales in the selected date range.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Order #</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {sales.map((sale) => (
                    <tr
                      key={sale.order_id}
                      onClick={() => navigate(`/sales-orders/${sale.order_id}`)}
                      className="cursor-pointer hover:bg-red-50"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                        {sale.client_name || `Client ${sale.client_id}`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {sale.so_number}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                        {formatDate(sale.order_date)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-900">
                        {formatNumber(sale.quantity)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-gray-700">
                        {formatCurrency(sale.unit_price)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-gray-900">
                        {formatCurrency(sale.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={3} className="px-3 py-2 text-[10px] font-semibold text-gray-700">Total</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">{formatNumber(totalQuantity)}</td>
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

export default ProductSaleDetailPage;
