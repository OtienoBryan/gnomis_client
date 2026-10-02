import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { purchaseOrdersService, suppliersService } from '../services/financialService';
import { PurchaseOrder, Supplier } from '../types/financial';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const formatCurrency = (amount: number) =>
  Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDate = (date?: string) => (date ? new Date(date).toLocaleDateString() : 'N/A');

const SupplierInvoicePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<(PurchaseOrder & { invoice_number?: string; supplier?: Supplier }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await purchaseOrdersService.getById(Number(id));
        if (res.success && res.data) {
          setPo(res.data);
          if (res.data.supplier_id) {
            try {
              const sres = await suppliersService.getById(res.data.supplier_id);
              if (sres.success && sres.data) setSupplier(sres.data as Supplier);
            } catch {
              // ignore supplier fetch failure; page will still render
            }
          }
        } else setError(res.error || 'Failed to load invoice');
      } catch (e) {
        setError('Failed to load invoice');
      } finally {
        setLoading(false);
      }
    };
    if (id) load();
  }, [id]);

  const handleExportPDF = async () => {
    if (!invoiceRef.current) return;
    try {
      setGeneratingPdf(true);
      const canvas = await html2canvas(invoiceRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pageWidth * 0.9;
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      const xOffset = (pageWidth - pdfWidth) / 2;
      pdf.addImage(imgData, 'PNG', xOffset, 10, pdfWidth, pdfHeight);
      pdf.save(`supplier_invoice_${po?.invoice_number || id}.pdf`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );

  if (error || !po)
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-3 text-xs text-red-700">{error || 'Invoice not found'}</div>
        </div>
      </div>
    );

  const supplierName = supplier?.company_name || (po as any).supplier_name || po.supplier?.company_name || 'N/A';
  const supplierCode = supplier?.supplier_code || (po as any).supplier_code;
  const invoiceNumber = po.invoice_number || po.po_number;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-red-100 rounded-md">
              <FileText className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Supplier Invoice</h1>
              <p className="mt-0.5 text-xs text-gray-600">#{invoiceNumber}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Link
              to={`/purchase-orders/${po.id}`}
              className="inline-flex items-center px-2.5 py-1 border border-gray-300 text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Purchase Order
            </Link>
            <button
              onClick={handleExportPDF}
              disabled={generatingPdf}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              title="Export to PDF"
            >
              <Download className="w-3 h-3 mr-1.5" />
              {generatingPdf ? 'Generating...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* PDF Content - This is what will be exported */}
        <div ref={invoiceRef} className="bg-white p-8 shadow-lg rounded-lg">
          {/* Professional Header */}
          <div className="border-b-2 border-red-600 pb-6 mb-6">
            <div className="flex justify-between items-start">
              {/* Company Information */}
              <div className="company-info">
                <img
                  src="/logo.jpg"
                  alt="Company Logo"
                  className="h-16 w-auto object-contain mb-3"
                  style={{ maxWidth: '140px' }}
                />
                <h1 className="text-lg font-bold text-gray-900 mb-1">GNOMIS QUALITY PRODUCT</h1>
                <p className="text-xs text-gray-600">P.O Box 15470, Nairobi Kenya</p>
                <p className="text-xs text-gray-600">Tax PIN: P051904794X</p>
                <p className="text-xs text-gray-600">Email: info@gnomis.com</p>
              </div>

              {/* Invoice Details */}
              <div className="text-right">
                <h2 className="text-2xl font-bold text-red-600 mb-2">SUPPLIER INVOICE</h2>
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                  <div className="space-y-1">
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-semibold text-gray-600">Invoice No:</span>
                      <span className="text-xs font-bold text-gray-900">{po.invoice_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-semibold text-gray-600">PO Number:</span>
                      <span className="text-xs text-gray-900">{po.po_number}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-semibold text-gray-600">Date:</span>
                      <span className="text-xs text-gray-900">{formatDate(po.order_date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase border-b border-gray-300 pb-1">Supplier</h3>
                <div className="bg-red-50 p-4 rounded-md border border-red-100 space-y-1">
                  <p className="text-xs font-bold text-gray-900">{supplierName}</p>
                  {supplierCode && <p className="text-xs text-gray-700">Code: {supplierCode}</p>}
                  <p className="text-xs text-gray-700">{supplier?.address || po.supplier?.address || 'N/A'}</p>
                  <p className="text-xs text-gray-700">Tax PIN: {supplier?.tax_id || po.supplier?.tax_id || 'N/A'}</p>
                  {supplier?.email && <p className="text-xs text-gray-700">{supplier.email}</p>}
                  {supplier?.phone && <p className="text-xs text-gray-700">{supplier.phone}</p>}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase border-b border-gray-300 pb-1">Bill To</h3>
                <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-1">
                  <p className="text-xs font-bold text-gray-900">GNOMIS QUALITY PRODUCT</p>
                  <p className="text-xs text-gray-700">P.O Box 15470, Nairobi Kenya</p>
                  <p className="text-xs text-gray-700">Tax PIN: P051904794X</p>
                </div>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase border-b border-gray-300 pb-1">Invoice Items</h3>
            {po.items && po.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-300">
                  <thead className="bg-red-600 text-white">
                    <tr>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wide border-r border-red-500">Item</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-wide border-r border-red-500">Quantity</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide border-r border-red-500">Unit Price (incl.)</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide border-r border-red-500">Tax</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wide">Total (incl.)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {po.items.map((it, idx) => {
                      const name =
                        (it as any).product_name ||
                        it.product?.product_name ||
                        (it.raw_material_id ? `Raw material ${it.raw_material_id}` : `Product ${it.product_id}`);
                      const code = (it as any).product_code || it.product?.product_code;
                      return (
                        <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3 border-r border-gray-200">
                            <div className="text-xs font-semibold text-gray-900">{name}</div>
                            {code && <div className="text-[10px] text-gray-600 mt-0.5">Code: {code}</div>}
                          </td>
                          <td className="px-4 py-3 text-center text-xs font-medium text-gray-900 border-r border-gray-200">
                            {Number(it.quantity).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-900 border-r border-gray-200">
                            {formatCurrency(it.unit_price)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-gray-700 border-r border-gray-200">
                            {formatCurrency((it as any).tax_amount || 0)}
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-bold text-gray-900">{formatCurrency(it.total_price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-500">No items found for this purchase order.</p>
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-end mt-6 mb-6">
            <div className="w-80 border-2 border-red-600 rounded-md overflow-hidden">
              <div className="bg-red-600 px-4 py-2">
                <h3 className="text-sm font-bold text-white text-center">INVOICE SUMMARY</h3>
              </div>
              <div className="bg-white p-4 space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-700">Subtotal:</span>
                  <span className="text-xs font-bold text-gray-900">{formatCurrency(po.subtotal)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-700">Tax:</span>
                  <span className="text-xs font-bold text-gray-900">{formatCurrency(po.tax_amount)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 bg-red-50 -mx-4 px-4 py-3 rounded">
                  <span className="text-sm font-bold text-red-900">TOTAL AMOUNT:</span>
                  <span className="text-lg font-bold text-red-600">{formatCurrency(po.total_amount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t-2 border-gray-300">
            <p className="text-[10px] text-gray-600 mb-2">Notes:</p>
            <p className="text-[9px] text-gray-500">• Please reference the invoice number on all payments and correspondence</p>
            <p className="text-[9px] text-gray-500">• Invoice generated from purchase order {po.po_number}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupplierInvoicePage;
