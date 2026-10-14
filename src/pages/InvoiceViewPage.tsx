import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, AlertCircle } from 'lucide-react';
import { salesOrdersService } from '../services/financialService';
import { SalesOrder, SalesOrderItem } from '../types/financial';
import { exportElementToA4Pdf } from '../utils/pdfExport';

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion'];

const threeDigitsToWords = (n: number): string => {
  let str = '';
  if (n >= 100) {
    str += `${ONES[Math.floor(n / 100)]} Hundred`;
    n %= 100;
    if (n > 0) str += ' ';
  }
  if (n >= 20) {
    str += TENS[Math.floor(n / 10)];
    if (n % 10 > 0) str += `-${ONES[n % 10]}`;
  } else if (n > 0) {
    str += ONES[n];
  }
  return str;
};

const numberToWords = (num: number): string => {
  let n = Math.round(Math.abs(num));
  if (n === 0) return 'Zero';
  const chunks: string[] = [];
  let scaleIndex = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      chunks.unshift(`${threeDigitsToWords(chunk)}${SCALES[scaleIndex] ? ` ${SCALES[scaleIndex]}` : ''}`);
    }
    n = Math.floor(n / 1000);
    scaleIndex++;
  }
  return chunks.join(' ');
};

const InvoiceViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    if (id) fetchOrder(parseInt(id));
  }, [id]);

  const fetchOrder = async (orderId: number) => {
    try {
      setLoading(true);
      const response = await salesOrdersService.getById(orderId);
      if (response.success) {
        setOrder(response.data);
      } else {
        setError(response.error || 'Failed to fetch order');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch order');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const handleBack = () => navigate('/financial/customer-orders');

  const handlePrint = async () => {
    const element = document.querySelector('.a4-invoice-print') as HTMLElement;
    if (!element) return;
    setGeneratingPdf(true);
    try {
      await exportElementToA4Pdf(element, `invoice-${invoiceNumber.replace(/\//g, '-')}.pdf`);
    } catch (err) {
      console.error('PDF export failed, falling back to print:', err);
      window.print();
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error || 'Order not found'}</div>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <button onClick={handleBack} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const items: SalesOrderItem[] = order.items || [];
  const subtotal = Number(order.subtotal) || 0;
  const taxAmount = Number(order.tax_amount) || 0;
  const totalAmount = Number(order.total_amount) || 0;

  const taxedBase = items
    .filter((i) => (i as any).tax_type === '16%')
    .reduce((sum, i) => sum + (Number((i as any).net_price) || 0), 0);

  const invoiceYear = order.order_date ? new Date(order.order_date).getFullYear() : new Date().getFullYear();
  const invoiceNumber = `INV/${invoiceYear}/${String(order.id).padStart(5, '0')}`;

  const customer: any = order.customer || {};
  const customerName = order.customer_name || customer.name || 'N/A';
  const customerContact = customer.contact || customer.phone || '';
  const customerTaxPin = customer.tax_pin || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back button and Print button */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice {invoiceNumber}</h1>
              <p className="text-base text-gray-500">Order {order.so_number}</p>
            </div>
          </div>

          <button
            onClick={handlePrint}
            disabled={generatingPdf}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingPdf ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Generating PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>

        {/* Invoice Content - A4 Style Container */}
        <div className="a4-invoice-print m-2 relative">
          {/* Header Section */}
          <div className="invoice-header">
            <div className="flex justify-between items-start">
              <img
                src="/logo.jpg"
                alt="Company Logo"
                className="h-20 w-auto object-contain"
                style={{ maxWidth: '120px' }}
              />
              <div className="text-right">
                <h1 className="company-name">GNOMIS QUALITY PRODUCTS</h1>
                <p className="company-address">P.O Box 15470, Nairobi Kenya</p>
                <p className="company-tax">Pin P051904794X</p>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <div className="text-right">
                <p className="customer-name">{customerName}</p>
                {customerContact && <p className="customer-address">{customerContact}</p>}
                {customerTaxPin && <p className="customer-tax">Tax ID: {customerTaxPin}</p>}
              </div>
            </div>
          </div>

          {/* Invoice Title & Meta */}
          <div className="invoice-title-section">
            <h2 className="invoice-title">Invoice {invoiceNumber}</h2>
            <div className="invoice-meta-row">
              <div>
                <p className="meta-label">Invoice Date:</p>
                <p className="meta-value">{formatDate(order.order_date)}</p>
              </div>
              <div>
                <p className="meta-label">Due Date:</p>
                <p className="meta-value">{formatDate(order.expected_delivery_date || order.order_date)}</p>
              </div>
              <div>
                <p className="meta-label">Source:</p>
                <p className="meta-value">{order.so_number}</p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="items-section">
            {items.length > 0 ? (
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th className="desc-col">DESCRIPTION</th>
                    <th className="qty-col">QUANTITY</th>
                    <th className="price-col">UNIT PRICE</th>
                    <th className="tax-col">VAT</th>
                    <th className="amount-col">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const description = item.product_name || `Product ${item.product_id}`;
                    return (
                      <tr key={index}>
                        <td className="desc-col">{description}</td>
                        <td className="qty-col">{Number(item.quantity).toFixed(2)}</td>
                        {/* VAT-inclusive unit price (LPO price) so quantity x price = amount */}
                        <td className="price-col">
                          {formatCurrency(Number(item.quantity) ? Number(item.total_price) / Number(item.quantity) : 0)}
                        </td>
                        <td className="tax-col">{formatCurrency(Number(item.tax_amount) || 0)}</td>
                        <td className="amount-col">{formatCurrency(Number(item.total_price))} KSh</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No items found for this order</p>
              </div>
            )}
          </div>

          {/* Totals Section */}
          <div className="totals-section">
            <div className="flex justify-between items-start">
              <p className="payment-communication">Payment Communication: <strong>{invoiceNumber}</strong></p>
              <table className="totals-table">
                <tbody>
                  <tr>
                    <td className="label">Untaxed Amount</td>
                    <td className="amount">{formatCurrency(subtotal)} KSh</td>
                  </tr>
                  <tr>
                    <td className="label">VAT 16% on {formatCurrency(taxedBase)} KSh</td>
                    <td className="amount">{formatCurrency(taxAmount)} KSh</td>
                  </tr>
                  <tr className="total-row">
                    <td className="label">Total</td>
                    <td className="amount">{formatCurrency(totalAmount)} KSh</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="amount-words">
              Total amount in words: {numberToWords(totalAmount)} Shillings
            </p>
          </div>

        </div>
      </div>

      <style>{`
        .a4-invoice-print {
          width: 210mm;
          background: #fff;
          margin: 0 auto;
          padding: 20mm 15mm;
          box-sizing: border-box;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }

        .invoice-header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 15px;
          margin-bottom: 15px;
        }

        .company-name {
          font-size: 14px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 4px;
        }

        .company-address, .company-tax {
          color: #6b7280;
          margin-bottom: 2px;
          font-size: 10px;
        }

        .customer-name {
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 2px;
          font-size: 11px;
        }

        .customer-address {
          color: #6b7280;
          margin-bottom: 2px;
          font-size: 10px;
        }

        .customer-tax {
          color: #6b7280;
          font-size: 10px;
        }

        .invoice-title-section {
          margin-bottom: 15px;
        }

        .invoice-title {
          font-size: 20px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 10px;
        }

        .invoice-meta-row {
          display: flex;
          gap: 40px;
        }

        .meta-label {
          font-size: 10px;
          font-weight: bold;
          color: #374151;
          margin-bottom: 2px;
        }

        .meta-value {
          font-size: 10px;
          color: #6b7280;
        }

        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 15px;
        }

        .invoice-table th {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 6px 6px;
          text-align: left;
          font-weight: bold;
          color: #374151;
          font-size: 9px;
        }

        .invoice-table td {
          border: 1px solid #e5e7eb;
          padding: 6px 6px;
          color: #374151;
          font-size: 9px;
        }

        .desc-col { width: 38%; }
        .qty-col { width: 12%; text-align: right; }
        .price-col { width: 15%; text-align: right; }
        .tax-col { width: 20%; text-align: right; }
        .amount-col { width: 15%; text-align: right; }

        .totals-section {
          margin-top: 10px;
        }

        .payment-communication {
          font-size: 9px;
          color: #6b7280;
          margin-top: auto;
        }

        .totals-table {
          border-collapse: collapse;
          min-width: 260px;
        }

        .totals-table td {
          padding: 4px 8px;
          border: 1px solid #e5e7eb;
          font-size: 9px;
        }

        .totals-table .label {
          text-align: left;
          color: #374151;
        }

        .totals-table .amount {
          text-align: right;
          color: #1f2937;
        }

        .total-row td {
          background: #374151;
          color: #fff !important;
          font-weight: bold;
          font-size: 10px;
        }

        .amount-words {
          text-align: right;
          font-size: 9px;
          color: #6b7280;
          margin-top: 6px;
        }

        .invoice-footer {
          width: 100%;
          padding: 15px 0 0 0;
          border-top: 2px solid #e5e7eb;
          margin-top: 25px;
          text-align: center;
        }

        .invoice-footer p {
          color: #6b7280;
          margin-bottom: 3px;
          font-size: 8px;
        }

        .strictly-note {
          font-weight: bold;
          margin-top: 6px;
        }

        @media print {
          body { background: #fff !important; }
          .a4-invoice-print {
            box-shadow: none !important;
            width: 210mm !important;
            margin: 0 !important;
            padding: 15mm !important;
          }
          .a4-invoice-print table { table-layout: fixed; width: 100%; }
          .a4-invoice-print th, .a4-invoice-print td {
            word-break: break-word;
            overflow-wrap: break-word;
            padding: 2px 4px;
            font-size: 8px;
          }
          .a4-invoice-print tr, .a4-invoice-print table { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default InvoiceViewPage;
