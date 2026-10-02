import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Minus, Trash2, Package, Search, X, ShoppingCart, Check } from 'lucide-react';
import axios from 'axios';
import { suppliersService, purchaseOrdersService } from '../services/financialService';
import { Supplier, CreatePurchaseOrderForm, TaxType } from '../types/financial';

interface RawMaterial {
  id: number;
  name: string;
  unit: string;
  alert_qty: number;
  cost: number;
  total: number; // current stock across all stores
}

interface CartItem {
  raw_material_id: number;
  material: RawMaterial;
  quantity: number;
  unit_price: number; // tax-exclusive unit price entered by the user
  tax_type: TaxType; // '16%' | 'zero_rated' | 'exempted'
}

const getTaxRate = (taxType: TaxType): number => (taxType === '16%' ? 0.16 : 0);

const money = (n: number) =>
  Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PurchaseOrderPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Order state
  const [selectedSupplier, setSelectedSupplier] = useState<number | ''>('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Catalog state
  const [materialSearch, setMaterialSearch] = useState('');

  // Supplier picker state
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierList, setShowSupplierList] = useState(false);
  const supplierBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const [suppliersRes, materialsRes] = await Promise.all([
          suppliersService.getAll(),
          axios.get('/api/financial/raw-materials/inventory'),
        ]);
        if (suppliersRes.success && suppliersRes.data) setSuppliers(suppliersRes.data);
        if (materialsRes.data?.success) setMaterials(materialsRes.data.data.materials || []);
      } catch (err) {
        setError('Failed to fetch initial data');
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  // Close supplier list when clicking outside
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (supplierBoxRef.current && !supplierBoxRef.current.contains(e.target as Node)) {
        setShowSupplierList(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(m => m.name.toLowerCase().includes(q));
  }, [materials, materialSearch]);

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(s =>
      [s.company_name, s.contact_person, s.email, s.phone, s.supplier_code].some(v => (v || '').toLowerCase().includes(q))
    );
  }, [suppliers, supplierSearch]);

  const supplier = suppliers.find(s => s.id === selectedSupplier);

  /* ── cart ── */
  const addToCart = (material: RawMaterial) => {
    setError(null);
    setSuccess(null);
    setCart(prev => {
      const existing = prev.find(i => i.raw_material_id === material.id);
      if (existing) {
        return prev.map(i => (i.raw_material_id === material.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { raw_material_id: material.id, material, quantity: 1, unit_price: Number(material.cost) || 0, tax_type: '16%' }];
    });
  };

  const updateCartItem = (id: number, patch: Partial<CartItem>) =>
    setCart(prev => prev.map(i => (i.raw_material_id === id ? { ...i, ...patch } : i)));

  const changeQty = (id: number, delta: number) =>
    setCart(prev => prev.map(i => (i.raw_material_id === id ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)));

  const removeFromCart = (id: number) => setCart(prev => prev.filter(i => i.raw_material_id !== id));

  const qtyInCart = (id: number) => cart.find(i => i.raw_material_id === id)?.quantity || 0;

  /* ── totals ── */
  const lineNet = (i: CartItem) => i.quantity * i.unit_price;
  const lineTotal = (i: CartItem) => lineNet(i) * (1 + getTaxRate(i.tax_type));
  const subtotal = cart.reduce((sum, i) => sum + lineNet(i), 0);
  const tax = cart.reduce((sum, i) => sum + lineNet(i) * getTaxRate(i.tax_type), 0);
  const total = cart.reduce((sum, i) => sum + lineTotal(i), 0);
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  /* ── supplier ── */
  const selectSupplier = (s: Supplier) => {
    setSelectedSupplier(s.id);
    setSupplierSearch('');
    setShowSupplierList(false);
  };

  /* ── submit ── */
  const resetOrder = () => {
    setSelectedSupplier('');
    setSupplierSearch('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setExpectedDeliveryDate('');
    setNotes('');
    setCart([]);
  };

  const validate = (): boolean => {
    if (!selectedSupplier) {
      setError('Please select a supplier');
      return false;
    }
    if (cart.length === 0) {
      setError('Please add at least one raw material');
      return false;
    }
    const bad = cart.find(i => i.quantity <= 0 || i.unit_price <= 0);
    if (bad) {
      setError(`Enter a quantity and a unit price greater than 0 for "${bad.material.name}"`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!validate()) return;
    try {
      setSaving(true);
      const data: CreatePurchaseOrderForm = {
        supplier_id: selectedSupplier as number,
        order_date: orderDate,
        expected_delivery_date: expectedDeliveryDate || undefined,
        notes: notes || undefined,
        items: cart.map(i => ({
          raw_material_id: i.raw_material_id,
          quantity: i.quantity,
          // The API stores the tax-inclusive unit price
          unit_price: Number((i.unit_price * (1 + getTaxRate(i.tax_type))).toFixed(2)),
          tax_type: i.tax_type,
        })),
      };
      const response = await purchaseOrdersService.create(data);
      if (response.success) {
        setSuccess('Purchase order created successfully');
        resetOrder();
      } else {
        setError(response.error || 'Failed to create purchase order');
      }
    } catch (err) {
      setError('Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f3f5fd] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const inputClass =
    'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white';

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">New Purchase Order</h1>
            <p className="text-xs text-gray-500">Tap raw materials to add them to the order.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4 items-start">
          {/* ───────── Catalog ───────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                value={materialSearch}
                onChange={e => setMaterialSearch(e.target.value)}
                placeholder="Search raw materials..."
                className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
            </div>

            {filteredMaterials.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {materials.length === 0 ? 'No raw materials yet. Add some on the Raw Materials page.' : 'No raw materials found'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                {filteredMaterials.map(m => {
                  const inCart = qtyInCart(m.id);
                  const low = m.alert_qty > 0 && m.total <= m.alert_qty;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => addToCart(m)}
                      className={`relative text-left bg-white border rounded-lg p-2 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
                        inCart ? 'border-red-400 ring-1 ring-red-200' : 'border-gray-200'
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-gray-900 leading-tight line-clamp-2">{m.name}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">Unit: {m.unit}</p>
                      <p className="text-[11px] font-bold text-gray-900 mt-0.5">{money(Number(m.cost) || 0)}</p>
                      <div className="mt-1">
                        <span
                          className={`text-[9px] font-medium px-1 py-0.5 rounded-full ${
                            low ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {Number(m.total).toLocaleString()} {m.unit}
                        </span>
                      </div>
                      {inCart > 0 && (
                        <span className="absolute -top-2 -right-2 inline-flex items-center justify-center h-5 min-w-[1.25rem] px-1 rounded-full text-[10px] font-semibold bg-red-500 text-white shadow">
                          {inCart}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ───────── Order panel ───────── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
            {/* Supplier + dates */}
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div ref={supplierBoxRef} className="relative">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Supplier <span className="text-red-500">*</span>
                </label>
                {supplier ? (
                  <div className="flex items-center justify-between gap-2 border border-green-200 bg-green-50 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-green-900 truncate">{supplier.company_name}</p>
                      <p className="text-[10px] text-green-700 truncate">
                        {[supplier.supplier_code, supplier.phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedSupplier('')}
                      className="text-green-700 hover:text-green-900"
                      title="Change supplier"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      value={supplierSearch}
                      onChange={e => {
                        setSupplierSearch(e.target.value);
                        setShowSupplierList(true);
                      }}
                      onFocus={() => setShowSupplierList(true)}
                      placeholder="Search supplier..."
                      className={inputClass}
                    />
                    {showSupplierList && (
                      <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {filteredSuppliers.length === 0 ? (
                          <p className="px-3 py-3 text-xs text-gray-500 text-center">No suppliers found</p>
                        ) : (
                          filteredSuppliers.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => selectSupplier(s)}
                              className="w-full text-left px-3 py-2 hover:bg-red-50 border-b border-gray-50 last:border-0"
                            >
                              <p className="text-xs font-medium text-gray-900">{s.company_name}</p>
                              <p className="text-[10px] text-gray-500">
                                {[s.supplier_code, s.phone, s.email].filter(Boolean).join(' · ')}
                              </p>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Order Date</label>
                  <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Expected</label>
                  <input
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={e => setExpectedDeliveryDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {/* Cart */}
            <div className="flex-1 overflow-y-auto min-h-[160px] max-h-[360px] lg:max-h-none">
              {cart.length === 0 ? (
                <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-gray-400 py-8">
                  <ShoppingCart className="w-9 h-9 mb-2 opacity-50" />
                  <p className="text-xs">No items yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {cart.map(i => (
                    <li key={i.raw_material_id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-900 truncate">{i.material.name}</p>
                          <p className="text-[10px] text-gray-400">per {i.material.unit}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(i.raw_material_id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-[auto_1fr_auto] gap-2 items-center">
                        <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
                          <button type="button" onClick={() => changeQty(i.raw_material_id, -1)} className="px-2 py-1.5 hover:bg-gray-50">
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={i.quantity}
                            onChange={e => updateCartItem(i.raw_material_id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-12 text-center text-xs py-1 border-x border-gray-200 focus:outline-none"
                          />
                          <button type="button" onClick={() => changeQty(i.raw_material_id, 1)} className="px-2 py-1.5 hover:bg-gray-50">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={i.unit_price || ''}
                          onChange={e => updateCartItem(i.raw_material_id, { unit_price: parseFloat(e.target.value) || 0 })}
                          placeholder="Unit price"
                          title="Unit price (excl. tax)"
                          className={`${inputClass} text-right`}
                        />
                        <select
                          value={i.tax_type}
                          onChange={e => updateCartItem(i.raw_material_id, { tax_type: e.target.value as TaxType })}
                          className="border border-gray-200 rounded-lg px-1.5 py-1.5 text-[11px] bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                          title="Tax type"
                        >
                          <option value="16%">16%</option>
                          <option value="zero_rated">Zero</option>
                          <option value="exempted">Exempt</option>
                        </select>
                      </div>
                      <p className="text-right text-xs font-semibold text-gray-900 mt-1.5">{money(lineTotal(i))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Totals + action */}
            <div className="p-4 border-t border-gray-100 space-y-3 bg-gray-50/60 rounded-b-2xl">
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className={inputClass}
              />

              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Items</span>
                  <span>{itemCount}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax</span>
                  <span>{money(tax)}</span>
                </div>
                <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-200">
                  <span className="text-sm font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-gray-900">{money(total)}</span>
                </div>
              </div>

              {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
              {success && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  {success}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetOrder}
                  disabled={saving || (cart.length === 0 && !selectedSupplier)}
                  className="px-4 py-3 text-sm font-medium rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || cart.length === 0}
                  className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating...' : `Create Purchase Order · ${money(total)}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseOrderPage;
