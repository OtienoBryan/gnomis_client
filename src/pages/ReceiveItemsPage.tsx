import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Check } from 'lucide-react';
import { purchaseOrdersService, productsService } from '../services/financialService';
import { storeService } from '../services/storeService';
import { PurchaseOrder, Store, ReceiveItemsForm } from '../types/financial';

interface ReceivingItem {
  product_id: number;
  raw_material_id?: number | null;
  received_quantity: number;
  unit_cost: number;
  product_name?: string;
  product_code?: string;
  ordered: number;
  already_received: number;
  max_quantity: number;
}

const ReceiveItemsPage: React.FC = () => {
  const { purchaseOrderId } = useParams<{ purchaseOrderId: string }>();
  const navigate = useNavigate();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<number | ''>('');
  const [receivingItems, setReceivingItems] = useState<ReceivingItem[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (purchaseOrderId) {
      fetchPurchaseOrder();
      fetchStores();
    }
  }, [purchaseOrderId]);

  const fetchPurchaseOrder = async () => {
    try {
      const response = await purchaseOrdersService.getWithReceipts(parseInt(purchaseOrderId!));
      if (response.success) {
        setPurchaseOrder(response.data);
        // Initialize receiving items with remaining quantities
        const items: ReceivingItem[] =
          response.data.items?.map((item: any) => ({
            product_id: item.product_id,
            raw_material_id: item.raw_material_id ?? null,
            received_quantity: 0,
            unit_cost: item.unit_price,
            product_name: item.product_name,
            product_code: item.product_code,
            ordered: Number(item.quantity) || 0,
            already_received: Number(item.received_quantity) || 0,
            max_quantity: item.quantity - (item.received_quantity || 0),
          })) || [];
        setReceivingItems(items);
      } else {
        setError(response.error || 'Failed to fetch purchase order');
      }
    } catch (err) {
      setError('Failed to fetch purchase order');
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const response = await storeService.getAllStores();
      if (response.success) {
        setStores(response.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch stores:', err);
    }
  };

  const handleQuantityChange = (index: number, value: number) => {
    const updatedItems = [...receivingItems];
    const item = updatedItems[index];
    // Ensure quantity doesn't exceed max and is not negative
    updatedItems[index] = { ...item, received_quantity: Math.max(0, Math.min(value, item.max_quantity)) };
    setReceivingItems(updatedItems);
  };

  const receiveAll = () => setReceivingItems(items => items.map(i => ({ ...i, received_quantity: i.max_quantity })));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStore) {
      setError('Please select a store');
      return;
    }

    const itemsToReceive = receivingItems.filter(item => item.received_quantity > 0);

    if (itemsToReceive.length === 0) {
      setError('Please enter quantities for at least one item');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const receiveData: ReceiveItemsForm = {
        storeId: selectedStore as number,
        items: itemsToReceive,
        notes,
      };

      const response = await purchaseOrdersService.receiveItems(parseInt(purchaseOrderId!), receiveData);

      if (response.success) {
        // Update product cost prices for received items
        try {
          await Promise.all(
            itemsToReceive
              .filter(item => item.product_id)
              .map(item => productsService.update(item.product_id, { cost_price: item.unit_cost }))
          );
        } catch (updateError) {
          console.error('Failed to update product cost prices:', updateError);
          // Don't fail the entire operation, just log the error
        }

        alert('Items received successfully!');
        navigate('/purchase-orders');
      } else {
        setError(response.error || 'Failed to receive items');
      }
    } catch (err) {
      setError('Failed to receive items');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

  const getTotalReceiving = () => receivingItems.reduce((total, item) => total + item.received_quantity * item.unit_cost, 0);
  const getUnitsReceiving = () => receivingItems.reduce((total, item) => total + item.received_quantity, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f3f5fd]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error && !purchaseOrder) {
    return (
      <div className="min-h-screen bg-[#f3f5fd] p-6">
        <div className="max-w-xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">{error}</div>
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="min-h-screen bg-[#f3f5fd] p-6 text-center">
        <h3 className="text-sm font-medium text-gray-900">Purchase Order not found</h3>
      </div>
    );
  }

  const fieldClass =
    'block w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';
  const th = 'px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider';

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Receive Items</h1>
              <p className="text-[11px] text-gray-500">Purchase Order {purchaseOrder.po_number}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/purchase-orders')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Purchase Orders
          </button>
        </div>

        {/* PO summary strip */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">PO Number</p>
            <p className="text-xs font-semibold text-gray-900">{purchaseOrder.po_number}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Supplier</p>
            <p className="text-xs font-semibold text-gray-900 truncate">{(purchaseOrder as any).supplier_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Order Date</p>
            <p className="text-xs font-semibold text-gray-900">{new Date(purchaseOrder.order_date).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</p>
            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-600 capitalize">
              {purchaseOrder.status}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-3 items-start">
          {/* Items table */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
              <h2 className="text-xs font-bold text-gray-900">Items to Receive</h2>
              <button
                type="button"
                onClick={receiveAll}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                Receive all remaining
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className={`${th} text-left`}>Item</th>
                    <th className={`${th} text-right`}>Ordered</th>
                    <th className={`${th} text-right`}>Received</th>
                    <th className={`${th} text-right`}>Remaining</th>
                    <th className={`${th} text-center`}>Receive Qty</th>
                    <th className={`${th} text-right`}>Unit Cost</th>
                    <th className={`${th} text-right`}>Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receivingItems.map((item, index) => (
                    <tr key={`${item.product_id ?? 'rm'}-${index}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="text-xs font-semibold text-gray-900">{item.product_name}</div>
                        {item.product_code && <div className="text-[10px] text-gray-400">{item.product_code}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-700">{item.ordered}</td>
                      <td className="px-3 py-2 text-right text-xs text-emerald-600 font-medium">{item.already_received}</td>
                      <td className="px-3 py-2 text-right text-xs text-orange-600 font-semibold">{item.max_quantity}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          max={item.max_quantity}
                          value={item.received_quantity === 0 ? '' : item.received_quantity}
                          onChange={e => handleQuantityChange(index, e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                          className="block w-20 mx-auto text-center border border-gray-200 rounded-lg py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 disabled:bg-gray-50"
                          disabled={item.max_quantity === 0}
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-700">{formatCurrency(item.unit_cost)}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-gray-900">
                        {formatCurrency(item.received_quantity * item.unit_cost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3 lg:sticky lg:top-4">
            <div>
              <label htmlFor="store" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Receiving Store <span className="text-red-500">*</span>
              </label>
              <select
                id="store"
                value={selectedStore}
                onChange={e => setSelectedStore(e.target.value ? parseInt(e.target.value) : '')}
                className={fieldClass}
                required
              >
                <option value="">Select a store...</option>
                {stores.map(store => (
                  <option key={store.id} value={store.id}>
                    {store.store_name} ({store.store_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="notes" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className={fieldClass}
                placeholder="Add any notes about this receipt..."
              />
            </div>

            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-1">
              <div className="flex justify-between text-[11px] text-gray-600">
                <span>Units receiving</span>
                <span className="font-semibold text-gray-900">{getUnitsReceiving()}</span>
              </div>
              <div className="flex justify-between items-baseline pt-1 border-t border-emerald-100">
                <span className="text-xs font-semibold text-gray-900">Total receiving</span>
                <span className="text-base font-bold text-emerald-600">{formatCurrency(getTotalReceiving())}</span>
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-700">{error}</div>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate('/purchase-orders')}
                className="px-3 py-2 border border-gray-200 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || getTotalReceiving() === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5" />
                {submitting ? 'Receiving...' : 'Receive Items'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReceiveItemsPage;
