import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { API_CONFIG } from '../config/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SupplierPayment {
  id: number;
  payment_number: string;
  supplier_id: number;
  purchase_order_id: number | null;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  amount: number;
  notes: string;
  reference: string;
  status: string;
  account_code: string | null;
  account_name: string | null;
  company_name: string;
  contact_person: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  supplier_tax_id: string | null;
  supplier_address: string | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(Number(amount) || 0);

const formatDate = (dateString: string) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatMethod = (method: string) =>
  (method || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const SupplierPaymentReceiptPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const receiptRef = useRef<HTMLDivElement>(null);

  const [payment, setPayment] = useState<SupplierPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPayment(id);
    }
  }, [id]);

  const fetchPayment = async (paymentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = API_CONFIG.getUrl(`/financial/payments/${paymentId}`);
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch payment`);
      }

      const data = await response.json();
      if (data.success) {
        setPayment(data.data);
      } else {
        throw new Error(data.error || 'Failed to fetch payment');
      }
    } catch (err: any) {
      console.error('Error fetching supplier payment:', err);
      setError(err.message || 'Failed to fetch payment');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!receiptRef.current) return;
    try {
      setExportingPdf(true);
      const canvas = await html2canvas(receiptRef.current, { scale: 2.5, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pageWidth * 0.9;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const xOffset = (pageWidth - pdfWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, 24, pdfWidth, pdfHeight);
      pdf.save(`payment_receipt_${payment?.payment_number || id}.pdf`);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-3 text-xs text-gray-600">Loading payment receipt...</p>
        </div>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xs font-semibold text-red-600">Error</p>
          <p className="text-xs text-red-600 mt-1">{error || 'Payment not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4 max-w-3xl">
        {/* Header */}
        <div className="mb-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-red-600 hover:text-red-700 mb-2.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Back</span>
          </button>

          <div className="bg-white border border-gray-200 rounded-md p-3 flex items-center justify-between gap-2.5">
            <div>
              <h1 className="text-sm font-bold text-gray-900">Payment Receipt</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">{payment.payment_number}</p>
            </div>
            <button
              onClick={handleExportPDF}
              disabled={exportingPdf}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-700 text-white text-xs font-medium rounded-md hover:bg-gray-900 disabled:opacity-50"
            >
              <Download className="h-3 w-3" />
              {exportingPdf ? 'Exporting...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Printable receipt */}
        <div ref={receiptRef} className="bg-white border border-gray-200 rounded-md p-5">
          <div className="flex items-start justify-between border-b-2 border-red-600 pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-gray-900">GNOMIS QUALITY PRODUCT</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">P.O Box 15470, Nairobi Kenya</p>
              <p className="text-[10px] text-gray-500">Tax PIN: P051904794X</p>
            </div>
            <div className="text-right">
              <h3 className="text-red-600 font-bold text-xs uppercase">Payment Receipt</h3>
              <p className="text-[10px] text-gray-600 mt-1">{payment.payment_number}</p>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium mt-1 capitalize ${
                payment.status === 'confirmed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
              }`}>
                {payment.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Paid To</h4>
              <p className="text-xs font-medium text-gray-900">{payment.company_name || `Supplier ${payment.supplier_id}`}</p>
              {payment.contact_person && <p className="text-[10px] text-gray-600 mt-0.5">{payment.contact_person}</p>}
              {payment.supplier_address && <p className="text-[10px] text-gray-500 mt-0.5">{payment.supplier_address}</p>}
              {payment.supplier_email && <p className="text-[10px] text-gray-500">{payment.supplier_email}</p>}
              {payment.supplier_phone && <p className="text-[10px] text-gray-500">{payment.supplier_phone}</p>}
              {payment.supplier_tax_id && <p className="text-[10px] text-gray-500 mt-0.5">Tax PIN: {payment.supplier_tax_id}</p>}
            </div>
            <div>
              <h4 className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Payment Details</h4>
              <div className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">Date</span>
                  <span className="text-gray-900 font-medium">{formatDate(payment.payment_date)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">Method</span>
                  <span className="text-gray-900 font-medium">{formatMethod(payment.payment_method)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-gray-500">Account</span>
                  <span className="text-gray-900 font-medium">
                    {payment.account_name ? `${payment.account_code ? payment.account_code + ' - ' : ''}${payment.account_name}` : '-'}
                  </span>
                </div>
                {(payment.reference || payment.reference_number) && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-gray-500">Reference</span>
                    <span className="text-gray-900 font-medium">{payment.reference || payment.reference_number}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-gray-700">Amount Paid</span>
            <span className="text-base font-bold text-red-700">{formatCurrency(payment.amount)}</span>
          </div>

          {payment.notes && (
            <div className="mb-2">
              <h4 className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Notes</h4>
              <p className="text-[10px] text-gray-700">{payment.notes}</p>
            </div>
          )}

          <div className="mt-4 pt-2 border-t border-gray-200 text-center">
            <p className="text-[9px] text-gray-400">
              Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierPaymentReceiptPage;
