import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { purchaseOrdersService } from '../services/financialService';

type PaymentStatus = 'paid' | 'partial' | 'unpaid';
type StatusFilter = 'all' | PaymentStatus;

interface InvoiceRow {
  id: number;
  invoice_number: string;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  order_date: string;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: PaymentStatus;
}

const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_LABEL: Record<PaymentStatus, string> = { paid: 'Paid', partial: 'Partially paid', unpaid: 'Unpaid' };
const STATUS_CLASS: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-red-100 text-red-700',
};

const AllSupplierInvoicesPage: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [supplierFilter, setSupplierFilter] = useState('');

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await purchaseOrdersService.getAll();
      if (!res.success) {
        setError(res.error || 'Failed to fetch supplier invoices');
        return;
      }
      // An invoice is raised for a purchase order once goods are received
      const rows: InvoiceRow[] = (res.data || [])
        .filter((po: any) => po.invoice_number && po.status !== 'cancelled')
        .map((po: any) => {
          const total = Number(po.total_amount) || 0;
          const paid = Number(po.amount_paid) || 0;
          const balance = Math.max(0, total - paid);
          const status: PaymentStatus = balance <= 0.005 ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
          return {
            id: po.id,
            invoice_number: po.invoice_number,
            po_number: po.po_number,
            supplier_id: po.supplier_id,
            supplier_name: po.supplier_name || 'N/A',
            order_date: po.order_date,
            total_amount: total,
            amount_paid: paid,
            balance,
            status,
          };
        });
      setInvoices(rows);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch supplier invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const suppliers = useMemo(() => {
    const map = new Map<number, string>();
    invoices.forEach(i => map.set(i.supplier_id, i.supplier_name));
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter(i => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (supplierFilter && String(i.supplier_id) !== supplierFilter) return false;
      if (!q) return true;
      return [i.invoice_number, i.po_number, i.supplier_name].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [invoices, search, statusFilter, supplierFilter]);

  const count = (s: PaymentStatus) => invoices.filter(i => i.status === s).length;
  const totalInvoiced = invoices.reduce((sum, i) => sum + i.total_amount, 0);
  const totalPaid = invoices.reduce((sum, i) => sum + i.amount_paid, 0);
  const totalOutstanding = invoices.reduce((sum, i) => sum + i.balance, 0);
  const shown = rows.reduce(
    (acc, i) => ({ total: acc.total + i.total_amount, paid: acc.paid + i.amount_paid, balance: acc.balance + i.balance }),
    { total: 0, paid: 0, balance: 0 }
  );

  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  const chip = (value: StatusFilter, label: string, n: number) => (
    <button
      type="button"
      onClick={() => setStatusFilter(value)}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
        statusFilter === value ? 'bg-red-600 text-white border-red-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label}
      <span className={`ml-1.5 ${statusFilter === value ? 'text-red-100' : 'text-gray-400'}`}>{n}</span>
    </button>
  );

  const stat = (label: string, value: string, hint: string, valueClass = 'text-gray-900') => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 min-w-0">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-bold truncate ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-gray-400">{hint}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Supplier Invoices</h1>
            <p className="text-xs text-gray-500 mt-0.5">Invoices from all suppliers and whether they have been paid.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/supplier-payments"
              className="px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700"
            >
              Supplier Payments
            </Link>
            <button
              type="button"
              onClick={fetchInvoices}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mb-4">{error}</div>}

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          {stat('Total Invoiced', money(totalInvoiced), `${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`)}
          {stat('Paid', money(totalPaid), `${count('paid')} fully paid`, 'text-emerald-600')}
          {stat('Outstanding', money(totalOutstanding), `${count('unpaid') + count('partial')} awaiting payment`, 'text-red-600')}
          {stat('Suppliers', String(suppliers.length), 'With invoices')}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {chip('all', 'All', invoices.length)}
              {chip('unpaid', 'Unpaid', count('unpaid'))}
              {chip('partial', 'Partially paid', count('partial'))}
              {chip('paid', 'Paid', count('paid'))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={supplierFilter}
                onChange={e => setSupplierFilter(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">All suppliers</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <input
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Search invoice, PO or supplier..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-3 text-sm text-gray-600">Loading invoices...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              {invoices.length === 0 ? 'No supplier invoices yet. An invoice is created when a purchase order is received.' : 'No invoices match your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Invoice No</th>
                    <th className={`${th} text-left`}>PO No</th>
                    <th className={`${th} text-left`}>Supplier</th>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-right`}>Total</th>
                    <th className={`${th} text-right`}>Paid</th>
                    <th className={`${th} text-right`}>Balance</th>
                    <th className={`${th} text-left`}>Status</th>
                    <th className={`${th} text-right`}></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(i => (
                    <tr key={i.id} className="hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{i.invoice_number}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">
                        <Link to={`/purchase-orders/${i.id}`} className="hover:underline hover:text-red-600">{i.po_number}</Link>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-900">{i.supplier_name}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{new Date(i.order_date).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-900">{money(i.total_amount)}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-emerald-700">{money(i.amount_paid)}</td>
                      <td className={`px-4 py-2.5 text-right text-xs font-semibold ${i.balance > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {money(i.balance)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_CLASS[i.status]}`}>
                          {STATUS_LABEL[i.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          to={`/supplier-invoice/${i.id}`}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={4} className="px-4 py-2.5 text-[11px] font-semibold text-gray-600 text-right">
                      Totals{rows.length !== invoices.length ? ' (filtered)' : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-gray-900">{money(shown.total)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-emerald-700">{money(shown.paid)}</td>
                    <td className="px-4 py-2.5 text-right text-xs font-bold text-red-600">{money(shown.balance)}</td>
                    <td colSpan={2}></td>
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

export default AllSupplierInvoicesPage;
