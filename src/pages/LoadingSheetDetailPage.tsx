import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadingSheetService, LoadingSheetDetail, LoadingSheetStatus } from '../services/financialService';

const STATUS_LABELS: Record<LoadingSheetStatus, string> = {
  assigned: 'Assigned',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
};

const STATUS_BADGE_CLASSES: Record<LoadingSheetStatus, string> = {
  assigned: 'bg-gray-100 text-gray-700',
  in_transit: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700'
};

const ORDER_STATUS_LABELS: Record<number, string> = {
  0: 'New',
  1: 'Approved',
  2: 'In Transit',
  3: 'Delivered',
  4: 'Cancelled',
  5: 'Declined',
  6: 'Returned to Stock'
};

const ORDER_STATUS_BADGE_CLASSES: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700',
  1: 'bg-yellow-100 text-yellow-700',
  2: 'bg-purple-100 text-purple-700',
  3: 'bg-green-100 text-green-700',
  4: 'bg-red-100 text-red-700',
  5: 'bg-red-100 text-red-700',
  6: 'bg-blue-100 text-blue-700'
};

const LoadingSheetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<LoadingSheetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [orderStatusError, setOrderStatusError] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<number>>(new Set());
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const fetchSheet = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await loadingSheetService.getById(Number(id));
      if (res.success && res.data) {
        setSheet(res.data);
      } else {
        setError(res.error || 'Failed to fetch loading sheet');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch loading sheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheet();
    // eslint-disable-next-line
  }, [id]);

  const handleStatusChange = async (status: LoadingSheetStatus) => {
    if (!sheet) return;

    let reason: string | undefined;
    if (status === 'cancelled') {
      const input = window.prompt('Reason for cancelling this loading sheet (optional):');
      if (input === null) return; // user hit Cancel on the prompt
      reason = input || undefined;
    }

    const confirmMessages: Record<LoadingSheetStatus, string> = {
      assigned: '',
      in_transit: 'Mark this loading sheet as In Transit? This updates all its orders.',
      delivered: 'Mark this loading sheet as Delivered? This marks all its orders as complete.',
      cancelled: 'Cancel this loading sheet? This cancels all its orders that have not already been delivered.'
    };
    if (!window.confirm(confirmMessages[status])) return;

    try {
      setUpdatingStatus(true);
      setStatusError(null);
      const res = await loadingSheetService.updateStatus(sheet.id, status, reason);
      if (res.success) {
        await fetchSheet();
      } else {
        setStatusError(res.error || 'Failed to update status');
      }
    } catch (err: any) {
      setStatusError(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleOrderStatusChange = async (orderId: number, status: 'in_transit' | 'delivered' | 'cancelled') => {
    if (!sheet) return;

    let reason: string | undefined;
    if (status === 'cancelled') {
      const input = window.prompt('Reason for cancelling this order (optional):');
      if (input === null) return;
      reason = input || undefined;
    }

    const confirmMessages = {
      in_transit: 'Mark this order as In Transit?',
      delivered: 'Mark this order as Delivered?',
      cancelled: 'Cancel this order?'
    };
    if (!window.confirm(confirmMessages[status])) return;

    try {
      setUpdatingOrderId(orderId);
      setOrderStatusError(null);
      const res = await loadingSheetService.updateOrderStatus(sheet.id, orderId, status, reason);
      if (res.success) {
        await fetchSheet();
      } else {
        setOrderStatusError(res.error || 'Failed to update order status');
      }
    } catch (err: any) {
      setOrderStatusError(err.response?.data?.error || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };

  const selectableOrders = sheet ? sheet.orders.filter((o) => o.my_status === 1 || o.my_status === 2) : [];

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === selectableOrders.length && selectableOrders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(selectableOrders.map((o) => o.id)));
    }
  };

  const handleBulkStatusChange = async (status: 'in_transit' | 'delivered' | 'cancelled') => {
    if (!sheet || selectedOrderIds.size === 0) return;

    let reason: string | undefined;
    if (status === 'cancelled') {
      const input = window.prompt('Reason for cancelling the selected orders (optional):');
      if (input === null) return;
      reason = input || undefined;
    }

    const confirmMessages = {
      in_transit: `Mark ${selectedOrderIds.size} selected order(s) as In Transit?`,
      delivered: `Mark ${selectedOrderIds.size} selected order(s) as Delivered?`,
      cancelled: `Cancel ${selectedOrderIds.size} selected order(s)?`
    };
    if (!window.confirm(confirmMessages[status])) return;

    try {
      setBulkUpdating(true);
      setOrderStatusError(null);
      const res = await loadingSheetService.updateSelectedOrdersStatus(sheet.id, Array.from(selectedOrderIds), status, reason);
      if (res.success) {
        setSelectedOrderIds(new Set());
        await fetchSheet();
      } else {
        setOrderStatusError(res.error || 'Failed to update selected orders');
      }
    } catch (err: any) {
      setOrderStatusError(err.response?.data?.error || 'Failed to update selected orders');
    } finally {
      setBulkUpdating(false);
    }
  };

  const formatDate = (d: string) => (d ? new Date(d).toLocaleDateString() : 'N/A');
  const formatDateTime = (d: string) => (d ? new Date(d).toLocaleString() : 'N/A');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !sheet) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto bg-red-50 border border-red-200 text-red-700 text-xs rounded-md p-4">
          {error || 'Loading sheet not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-3 print:hidden">
          <button
            onClick={() => navigate(-1)}
            className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-xs font-semibold"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold shadow-sm"
          >
            Print
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-6">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4 flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-gray-900">Loading Sheet {sheet.sheet_number}</h1>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_BADGE_CLASSES[sheet.status]}`}>
                  {STATUS_LABELS[sheet.status]}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Created {formatDateTime(sheet.created_at)}{sheet.created_by_name ? ` by ${sheet.created_by_name}` : ''}
                {sheet.updated_at && sheet.status !== 'assigned' ? ` — Updated ${formatDateTime(sheet.updated_at)}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              {sheet.status === 'assigned' && (
                <button
                  onClick={() => handleStatusChange('in_transit')}
                  disabled={updatingStatus}
                  className="px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  Mark In Transit
                </button>
              )}
              {sheet.status === 'in_transit' && (
                <button
                  onClick={() => handleStatusChange('delivered')}
                  disabled={updatingStatus}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs font-semibold shadow-sm disabled:opacity-50"
                >
                  Mark Delivered
                </button>
              )}
              {(sheet.status === 'assigned' || sheet.status === 'in_transit') && (
                <button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updatingStatus}
                  className="px-3 py-1.5 bg-gray-100 text-red-600 rounded-md hover:bg-red-50 text-xs font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {statusError && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[10px] rounded-md print:hidden">{statusError}</div>
          )}
          {orderStatusError && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 text-red-700 text-[10px] rounded-md print:hidden">{orderStatusError}</div>
          )}

          {selectedOrderIds.size > 0 && (
            <div className="mb-4 p-2.5 bg-blue-50 border border-blue-200 rounded-md flex items-center justify-between flex-wrap gap-2 print:hidden">
              <span className="text-[10px] font-semibold text-blue-800">{selectedOrderIds.size} order(s) selected</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleBulkStatusChange('in_transit')}
                  disabled={bulkUpdating}
                  className="px-2.5 py-1 bg-purple-600 text-white rounded text-[9px] font-semibold hover:bg-purple-700 disabled:opacity-50"
                >
                  Mark In Transit
                </button>
                <button
                  onClick={() => handleBulkStatusChange('delivered')}
                  disabled={bulkUpdating}
                  className="px-2.5 py-1 bg-green-600 text-white rounded text-[9px] font-semibold hover:bg-green-700 disabled:opacity-50"
                >
                  Mark Delivered
                </button>
                <button
                  onClick={() => handleBulkStatusChange('cancelled')}
                  disabled={bulkUpdating}
                  className="px-2.5 py-1 bg-white text-red-600 border border-red-200 rounded text-[9px] font-semibold hover:bg-red-50 disabled:opacity-50"
                >
                  Cancel Selected
                </button>
                <button
                  onClick={() => setSelectedOrderIds(new Set())}
                  disabled={bulkUpdating}
                  className="px-2.5 py-1 bg-white text-gray-600 border border-gray-200 rounded text-[9px] font-semibold hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-5 text-xs">
            <div>
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Driver</p>
              <p className="text-gray-900 font-medium mt-0.5">{sheet.driver_name || 'N/A'}</p>
              {sheet.driver_contact && <p className="text-gray-500 text-[10px]">{sheet.driver_contact}</p>}
            </div>
            <div>
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Vehicle</p>
              <p className="text-gray-900 font-medium mt-0.5">{sheet.vehicle_registration_number || 'N/A'}</p>
              {sheet.vehicle_model && <p className="text-gray-500 text-[10px]">{sheet.vehicle_model}</p>}
            </div>
          </div>

          {sheet.notes && (
            <div className="mb-5 text-xs">
              <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Notes</p>
              <p className="text-gray-700 mt-0.5">{sheet.notes}</p>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left w-8 print:hidden">
                    <input
                      type="checkbox"
                      checked={selectableOrders.length > 0 && selectedOrderIds.size === selectableOrders.length}
                      onChange={toggleSelectAll}
                      disabled={selectableOrders.length === 0}
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Order #</th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Address</th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sheet.orders.map((order) => {
                  const isUpdating = updatingOrderId === order.id;
                  const isSelectable = order.my_status === 1 || order.my_status === 2;
                  return (
                    <tr key={order.id} className={selectedOrderIds.has(order.id) ? 'bg-blue-50' : ''}>
                      <td className="px-3 py-2 print:hidden">
                        <input
                          type="checkbox"
                          checked={selectedOrderIds.has(order.id)}
                          onChange={() => toggleOrderSelection(order.id)}
                          disabled={!isSelectable}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">{order.so_number}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">{order.customer_name || 'N/A'}</td>
                      <td className="px-3 py-2 text-gray-500 text-[10px]">{order.customer_address || 'N/A'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-gray-700">{formatDate(order.order_date)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${ORDER_STATUS_BADGE_CLASSES[order.my_status] || 'bg-gray-100 text-gray-700'}`}>
                          {ORDER_STATUS_LABELS[order.my_status] || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap print:hidden">
                        <div className="flex items-center gap-1.5">
                          {order.my_status === 1 && (
                            <button
                              onClick={() => handleOrderStatusChange(order.id, 'in_transit')}
                              disabled={isUpdating}
                              className="px-2 py-1 bg-purple-600 text-white rounded text-[9px] font-semibold hover:bg-purple-700 disabled:opacity-50"
                            >
                              In Transit
                            </button>
                          )}
                          {order.my_status === 2 && (
                            <button
                              onClick={() => handleOrderStatusChange(order.id, 'delivered')}
                              disabled={isUpdating}
                              className="px-2 py-1 bg-green-600 text-white rounded text-[9px] font-semibold hover:bg-green-700 disabled:opacity-50"
                            >
                              Delivered
                            </button>
                          )}
                          {(order.my_status === 1 || order.my_status === 2) && (
                            <button
                              onClick={() => handleOrderStatusChange(order.id, 'cancelled')}
                              disabled={isUpdating}
                              className="px-2 py-1 bg-gray-100 text-red-600 rounded text-[9px] font-semibold hover:bg-red-50 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSheetDetailPage;
