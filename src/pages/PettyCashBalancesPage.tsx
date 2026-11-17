import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PiggyBank, AlertCircle, Search, ChevronRight, Wallet, Plus, Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { api } from '../services/api';

interface RepBalance {
  id: number;
  name: string;
  status?: string;
  role?: string | null;
  balance: number | string;
}

type Filter = 'all' | 'with' | 'zero';
type Sort = 'balance_desc' | 'balance_asc' | 'name';

const formatKES = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'KES' });

const StatCard: React.FC<{ label: string; value: string; icon: React.ReactNode; tone: string }> = ({
  label,
  value,
  icon,
  tone,
}) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tone}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-base font-bold text-gray-900 truncate">{value}</p>
    </div>
  </div>
);

const PettyCashBalancesPage: React.FC = () => {
  const navigate = useNavigate();
  const [reps, setReps] = useState<RepBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('balance_desc');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    api
      .get('/financial/petty-cash/sales-reps')
      .then(res => setReps(res.data.data || []))
      .catch(err => setError(err.response?.data?.error || err.message || 'Failed to load staff balances'))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ({ total: reps.reduce((s, r) => s + Number(r.balance || 0), 0) }), [reps]);

  const roles = useMemo(
    () => Array.from(new Set(reps.map(r => (r.role || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [reps]
  );
  const hasUnassigned = useMemo(() => reps.some(r => !(r.role || '').trim()), [reps]);

  const counts = useMemo(
    () => ({
      all: reps.length,
      with: reps.filter(r => Number(r.balance) !== 0).length,
      zero: reps.filter(r => Number(r.balance) === 0).length,
    }),
    [reps]
  );

  const visible = useMemo(() => {
    const list = reps
      .filter(r => r.name?.toLowerCase().includes(search.toLowerCase()))
      .filter(r => {
        const role = (r.role || '').trim();
        return roleFilter === 'all' ? true : roleFilter === '__none__' ? !role : role === roleFilter;
      })
      .filter(r => (filter === 'with' ? Number(r.balance) !== 0 : filter === 'zero' ? Number(r.balance) === 0 : true));
    const byBalance = (a: RepBalance, b: RepBalance) => Number(b.balance || 0) - Number(a.balance || 0);
    return [...list].sort((a, b) => {
      if (sort === 'balance_desc') return byBalance(a, b);
      if (sort === 'balance_asc') return -byBalance(a, b);
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [reps, search, filter, sort, roleFilter]);

  const visibleTotal = useMemo(() => visible.reduce((s, r) => s + Number(r.balance || 0), 0), [visible]);

  const exportRows = () => visible.map(r => [r.name || '', r.role || '', Number(r.balance || 0).toFixed(2)]);
  const stamp = () => new Date().toISOString().slice(0, 10);

  const exportCSV = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [['Staff', 'Role', 'Balance (KES)'].map(esc).join(',')];
    exportRows().forEach(r => lines.push([esc(r[0]), esc(r[1]), r[2]].join(',')));
    lines.push(['Total', '', visibleTotal.toFixed(2)].map((v, i) => (i === 2 ? v : esc(v))).join(','));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `petty-cash-balances-${stamp()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Staff Petty Cash Balances', 14, 16);
    doc.setFontSize(9);
    const roleLabel = roleFilter === 'all' ? 'All roles' : roleFilter === '__none__' ? 'No role' : roleFilter;
    doc.text(`Generated ${new Date().toLocaleString()}  |  Role: ${roleLabel}`, 14, 22);
    autoTable(doc, {
      startY: 27,
      head: [['Staff', 'Role', 'Balance (KES)']],
      body: visible.map(r => [r.name || '', r.role || '-', formatKES(r.balance).replace('KES', '').trim()]),
      foot: [['Total', '', formatKES(visibleTotal).replace('KES', '').trim()]],
      headStyles: { fillColor: [220, 38, 38] },
      footStyles: { fillColor: [243, 244, 246], textColor: 20 },
      columnStyles: { 2: { halign: 'right' } },
      styles: { fontSize: 9 },
    });
    doc.save(`petty-cash-balances-${stamp()}.pdf`);
  };

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'with', label: 'Holding cash' },
    { key: 'zero', label: 'Zero balance' },
  ];

  return (
    <div className="w-full px-4 py-5 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-red-600 flex items-center justify-center shadow-sm">
            <PiggyBank className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Staff Petty Cash Balances</h1>
            <p className="text-xs text-gray-500">Current petty cash held by each staff member</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={exportCSV}
          disabled={loading || visible.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
        <button
          onClick={exportPDF}
          disabled={loading || visible.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <FileText className="h-4 w-4" /> PDF
        </button>
        <Link
          to="/petty-cash"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Allocate Petty Cash
        </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-5 max-w-xs">
        <StatCard
          label="Total petty cash held"
          value={formatKES(stats.total)}
          icon={<Wallet className="h-5 w-5 text-red-600" />}
          tone="bg-red-50"
        />
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        {roles.length > 0 && (
          <div className="flex gap-1 overflow-x-auto px-3 pt-2 border-b border-gray-200">
            {[
              { key: 'all', label: 'All', count: reps.length },
              ...roles.map(r => ({ key: r, label: r, count: reps.filter(x => (x.role || '').trim() === r).length })),
              ...(hasUnassigned
                ? [{ key: '__none__', label: 'No role', count: reps.filter(x => !(x.role || '').trim()).length }]
                : []),
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setRoleFilter(t.key)}
                className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  roleFilter === t.key
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {t.label} <span className="text-gray-400 text-xs">({t.count})</span>
              </button>
            ))}
          </div>
        )}
        <div className="p-3 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-gray-200">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search staff by name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === t.key ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {t.label} <span className="text-gray-400">({counts[t.key]})</span>
              </button>
            ))}
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value as Sort)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-transparent"
          >
            <option value="balance_desc">Highest balance</option>
            <option value="balance_asc">Lowest balance</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Staff</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Balance</th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-red-600 mx-auto" />
                  </td>
                </tr>
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                    No staff match your filters
                  </td>
                </tr>
              ) : (
                visible.map(r => {
                  const bal = Number(r.balance || 0);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => navigate(`/petty-cash/staff/${r.id}`)}
                      className="hover:bg-red-50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900 group-hover:text-red-700">{r.name}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{r.role || '—'}</td>
                      <td className={`px-4 py-3 text-right text-sm font-bold whitespace-nowrap ${bal > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {formatKES(bal)}
                      </td>
                      <td className="px-4 py-3 text-gray-300 group-hover:text-red-500">
                        <ChevronRight className="h-4 w-4" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && visible.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td colSpan={2} className="px-4 py-3 text-xs text-gray-500">
                    Showing {visible.length} of {reps.length} staff
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{formatKES(visibleTotal)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default PettyCashBalancesPage;
