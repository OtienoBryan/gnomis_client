import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import RawMaterialRequestReviewModal from '../components/RawMaterialRequestReviewModal';
import RawMaterialProductionModal from '../components/RawMaterialProductionModal';

type RequestStatus = 'pending' | 'approved' | 'issued' | 'completed' | 'rejected' | 'cancelled';

interface RequestRow {
  id: number;
  request_number: string;
  status: RequestStatus;
  notes?: string | null;
  created_at: string;
  requested_by_name?: string;
  product_count: number;
  material_count: number;
}

interface RequestDetails extends Omit<RequestRow, 'product_count' | 'material_count'> {
  store_name?: string;
  reviewed_by_name?: string;
  reviewed_at?: string | null;
  review_note?: string | null;
  completed_at?: string | null;
  completed_by_name?: string;
  production_note?: string | null;
  products: { id: number; product_id: number; product_name?: string; quantity: number | string; produced_quantity?: number | string | null }[];
  items: { id: number; raw_material_id: number; name?: string; unit?: string; quantity: number | string; used_quantity?: number | string | null; returned_quantity?: number | string | null }[];
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  issued: 'Issued',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};
const STATUS_CLASS: Record<RequestStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  issued: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-indigo-100 text-indigo-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
};

const qty = (n: number | string) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 3 });
const dateTime = (d: string) => new Date(d).toLocaleString();

const StatusPill: React.FC<{ status: RequestStatus }> = ({ status }) => (
  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_CLASS[status] || STATUS_CLASS.pending}`}>
    {STATUS_LABEL[status] || status}
  </span>
);

const RawMaterialRequestsPage: React.FC = () => {
  const location = useLocation();
  const { user } = useAuth();
  const canReview = user?.role !== 'stock'; // the stock role cannot approve or decline
  const justCreated = (location.state as { created?: string } | null)?.created;

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<RequestDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [action, setAction] = useState<{ type: 'approve' | 'decline' | 'produce'; request: RequestDetails } | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get('/api/financial/raw-material-requests');
      if (res.data?.success) setRequests(res.data.data || []);
      else setError(res.data?.error || 'Failed to load requests');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const openRequest = async (id: number) => {
    setReviewMessage(null);
    setSelected(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const res = await axios.get(`/api/financial/raw-material-requests/${id}`);
      if (res.data?.success) setSelected(res.data.data);
      else setDetailsError(res.data?.error || 'Failed to load request');
    } catch (err: any) {
      setDetailsError(err.response?.data?.error || err.message || 'Failed to load request');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeDetails = () => {
    setSelected(null);
    setDetailsError(null);
    setDetailsLoading(false);
  };

  // Load the request, then open the approve / decline / confirm production pop-up for it
  const startAction = async (e: React.MouseEvent, id: number, type: 'approve' | 'decline' | 'produce') => {
    e.stopPropagation();
    setReviewMessage(null);
    setError(null);
    setActionLoadingId(id);
    try {
      const res = await axios.get(`/api/financial/raw-material-requests/${id}`);
      if (res.data?.success) setAction({ type, request: res.data.data });
      else setError(res.data?.error || 'Failed to load request');
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleActionDone = async () => {
    if (!action) return;
    const { type, request } = action;
    setAction(null);
    setReviewMessage(
      type === 'produce'
        ? `Production for request ${request.request_number} was confirmed. The products were added to stock and any unused raw materials were returned.`
        : type === 'approve'
        ? `Request ${request.request_number} was approved and issued. The raw materials were deducted from stock.`
        : `Request ${request.request_number} was declined.`
    );
    await fetchRequests();
  };

  const count = (s: RequestStatus) => requests.filter(r => r.status === s).length;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.request_number, r.requested_by_name].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [requests, statusFilter, search]);

  const chip = (value: 'all' | RequestStatus, label: string, n: number) => (
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

  const detailsOpen = detailsLoading || !!selected || !!detailsError;
  const th = 'px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap';

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full py-5 px-4 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Raw Material Requests</h1>
            <p className="text-xs text-gray-500 mt-0.5">Requests for raw materials to process into products. Click a request to see its details, or use the buttons to approve it or confirm production.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/raw-material-requests/new" className="px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700">
              New Request
            </Link>
            <Link
              to="/produced-products"
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Produced Products
            </Link>
            <Link
              to="/raw-material-usage"
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Raw Materials Used
            </Link>
            <button
              type="button"
              onClick={fetchRequests}
              disabled={loading}
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>

        {justCreated && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700">
            Request {justCreated} was submitted and is pending.
          </div>
        )}
        {reviewMessage && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-xs text-green-700">{reviewMessage}</div>
        )}
        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs mb-4">{error}</div>}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {chip('all', 'All', requests.length)}
              {chip('pending', 'Pending', count('pending'))}
              {chip('approved', 'Approved', count('approved'))}
              {chip('issued', 'Issued', count('issued'))}
              {chip('completed', 'Completed', count('completed'))}
              {chip('rejected', 'Rejected', count('rejected'))}
            </div>
            <input
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-56 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Search request no. or user..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              {requests.length === 0 ? 'No requests yet. Click "New Request" to create one.' : 'No requests match your filters.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Request No</th>
                    <th className={`${th} text-left`}>Date</th>
                    <th className={`${th} text-left`}>Requested By</th>
                    <th className={`${th} text-right`}>Products</th>
                    <th className={`${th} text-right`}>Raw Materials</th>
                    <th className={`${th} text-left`}>Status</th>
                    <th className={`${th} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.id} onClick={() => openRequest(r.id)} className="cursor-pointer hover:bg-gray-50/70">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs font-semibold text-gray-900">{r.request_number}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{dateTime(r.created_at)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-700">{r.requested_by_name || '—'}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{r.product_count}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-700">{r.material_count}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {r.status === 'pending' && canReview && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoadingId === r.id}
                                onClick={e => startAction(e, r.id, 'approve')}
                                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={actionLoadingId === r.id}
                                onClick={e => startAction(e, r.id, 'decline')}
                                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </>
                          )}
                          {r.status === 'issued' && (
                            <button
                              type="button"
                              disabled={actionLoadingId === r.id}
                              onClick={e => startAction(e, r.id, 'produce')}
                              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm disabled:opacity-50"
                            >
                              Confirm production
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detailsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6" onClick={closeDetails}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4 bg-gray-50">
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Raw material request</p>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-xl font-bold text-gray-900">{selected ? selected.request_number : 'Loading...'}</h2>
                  {selected && <StatusPill status={selected.status} />}
                </div>
                {selected && <p className="text-sm text-gray-500 mt-1">Created {dateTime(selected.created_at)}</p>}
              </div>
              <button type="button" onClick={closeDetails} className="text-gray-400 hover:text-gray-600 text-3xl leading-none" aria-label="Close">
                ×
              </button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">
              {detailsLoading && (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
                </div>
              )}
              {detailsError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{detailsError}</div>}

              {selected && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Requested by', value: selected.requested_by_name || '—' },
                      { label: 'Products to produce', value: selected.products.length },
                      { label: 'Raw materials', value: selected.items.length },
                      { label: 'Issued from', value: selected.store_name || '—' },
                    ].map(card => (
                      <div key={card.label} className="border border-gray-100 rounded-xl px-4 py-3 bg-white shadow-sm">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{card.label}</p>
                        <p className="text-base font-bold text-gray-900 mt-1 truncate">{card.value}</p>
                      </div>
                    ))}
                  </div>

                  {selected.notes && (
                    <div className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                      <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Request notes</span>
                      {selected.notes}
                    </div>
                  )}

                  {(!!selected.reviewed_at || !!selected.completed_at) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(selected.status as RequestStatus) !== 'pending' && selected.reviewed_at && (
                        <div className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 space-y-1">
                          <p>
                            <span className="font-semibold">{STATUS_LABEL[selected.status]}</span>
                            {selected.reviewed_by_name ? ` by ${selected.reviewed_by_name}` : ''} on {dateTime(selected.reviewed_at)}
                          </p>
                          {selected.review_note && <p>Note: {selected.review_note}</p>}
                        </div>
                      )}
                      {selected.status === 'completed' && selected.completed_at && (
                        <div className="text-sm text-gray-700 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 space-y-1">
                          <p>
                            <span className="font-semibold">Production confirmed</span>
                            {selected.completed_by_name ? ` by ${selected.completed_by_name}` : ''} on {dateTime(selected.completed_at)}
                          </p>
                          {selected.production_note && <p>Note: {selected.production_note}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-2">Products to produce</h3>
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className={`${th} text-left`}>Product</th>
                              <th className={`${th} text-right`}>Target qty</th>
                              {selected.status === 'completed' && <th className={`${th} text-right`}>Produced</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selected.products.map(p => (
                              <tr key={p.id}>
                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.product_name || `Product ${p.product_id}`}</td>
                                <td className="px-4 py-3 text-right text-sm text-gray-900">{qty(p.quantity)}</td>
                                {selected.status === 'completed' && (
                                  <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{qty(p.produced_quantity ?? 0)}</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-gray-900 mb-2">Raw materials requested</h3>
                      <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className={`${th} text-left`}>Raw material</th>
                              <th className={`${th} text-right`}>Quantity</th>
                              <th className={`${th} text-left`}>Unit</th>
                              {selected.status === 'completed' && (
                                <>
                                  <th className={`${th} text-right`}>Used</th>
                                  <th className={`${th} text-right`}>Returned</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {selected.items.map(i => (
                              <tr key={i.id}>
                                <td className="px-4 py-3 text-sm font-semibold text-gray-900">{i.name || `Raw material ${i.raw_material_id}`}</td>
                                <td className="px-4 py-3 text-right text-sm text-gray-900">{qty(i.quantity)}</td>
                                <td className="px-4 py-3 text-sm text-gray-600">{i.unit || ''}</td>
                                {selected.status === 'completed' && (
                                  <>
                                    <td className="px-4 py-3 text-right text-sm text-gray-900">{qty(i.used_quantity ?? 0)}</td>
                                    <td className="px-4 py-3 text-right text-sm text-blue-700">{qty(i.returned_quantity ?? 0)}</td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button type="button" onClick={closeDetails} className="px-5 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {action && action.type === 'produce' && (
        <RawMaterialProductionModal
          request={{
            id: action.request.id,
            request_number: action.request.request_number,
            store_name: action.request.store_name,
            products: action.request.products,
            items: action.request.items,
          }}
          onClose={() => setAction(null)}
          onDone={handleActionDone}
        />
      )}

      {action && action.type !== 'produce' && (
        <RawMaterialRequestReviewModal
          mode={action.type}
          request={{ id: action.request.id, request_number: action.request.request_number, items: action.request.items }}
          onClose={() => setAction(null)}
          onDone={handleActionDone}
        />
      )}
    </div>
  );
};

export default RawMaterialRequestsPage;
