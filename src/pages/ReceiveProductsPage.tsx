import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { storeService } from '../services/storeService';
import { productsService } from '../services/financialService';
import { Product, Store } from '../types/financial';

interface CartItem {
  product_id: number;
  product_name: string;
  quantity: number;
  unit_cost: number;
}

const money = (n: number) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fieldClass =
  'w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500';

const ReceiveProductsPage: React.FC = () => {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [storeId, setStoreId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [storesRes, productsRes] = await Promise.all([storeService.getAllStores(), productsService.getAll()]);
      if (storesRes.success) setStores(storesRes.data || []);
      if (productsRes.success) setProducts(productsRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load stores and products');
    }
    setLoading(false);
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return products.filter(p => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!term) return true;
      return p.product_name.toLowerCase().includes(term) || p.product_code.toLowerCase().includes(term);
    });
  }, [products, searchTerm, categoryFilter]);

  const addToCart = (product: Product) => {
    setSuccess(null);
    setError(null);
    setCart(prev => {
      const existing = prev.find(c => c.product_id === product.id);
      if (existing) {
        return prev.map(c => (c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.product_name,
          quantity: 1,
          unit_cost: Number(product.cost_price) || 0,
        },
      ];
    });
  };

  const updateCartItem = (productId: number, patch: Partial<CartItem>) =>
    setCart(prev => prev.map(c => (c.product_id === productId ? { ...c, ...patch } : c)));

  const changeQty = (productId: number, delta: number) =>
    setCart(prev => prev.map(c => (c.product_id === productId ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c)));

  const removeFromCart = (productId: number) => setCart(prev => prev.filter(c => c.product_id !== productId));

  const qtyInCart = (productId: number) => cart.find(c => c.product_id === productId)?.quantity || 0;

  const totalItems = cart.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
  const totalCost = cart.reduce((sum, c) => sum + (Number(c.quantity) || 0) * (Number(c.unit_cost) || 0), 0);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);

    if (!storeId) {
      setError('Please select a store to receive the products into');
      return;
    }
    if (!reference.trim()) {
      setError('Please enter a reference (e.g. a GRN or delivery note number)');
      return;
    }
    if (cart.length === 0) {
      setError('Add at least one product');
      return;
    }
    if (cart.some(c => !c.quantity || c.quantity <= 0)) {
      setError('Every item must have a quantity greater than 0');
      return;
    }

    setSubmitting(true);
    try {
      const res = await storeService.receiveStock({
        store_id: Number(storeId),
        items: cart.map(c => ({
          product_id: c.product_id,
          quantity: Number(c.quantity),
          unit_cost: Number(c.unit_cost) || 0,
        })),
        staff_id: user?.id,
        reference: reference.trim(),
      });
      if (res.success) {
        setSuccess(`Received ${cart.length} product${cart.length === 1 ? '' : 's'} successfully.`);
        setCart([]);
        setReference('');
      } else {
        setError(res.error || 'Failed to receive products');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to receive products');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#f3f5fd]">
      <div className="w-full px-3 sm:px-4 lg:px-6 py-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Receive Products</h1>
            <p className="text-xs text-gray-500">Tap products to add them, then receive them into a store.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/receiving-history"
              className="px-3 py-1.5 rounded-lg shadow-sm text-xs font-medium text-white bg-red-600 hover:bg-red-700"
            >
              Receiving History
            </Link>
            <Link
              to="/store-inventory"
              className="px-3 py-1.5 border border-gray-200 rounded-lg shadow-sm text-xs font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Store Inventory
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-red-600 mx-auto"></div>
            <p className="mt-3 text-sm text-gray-600">Loading stores and products...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] gap-4 items-start">
            {/* ───────── Product catalog ───────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />

              <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
                {['all', ...categories].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoryFilter(c)}
                    className={`whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      categoryFilter === c
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {c === 'all' ? 'All' : c}
                  </button>
                ))}
              </div>

              {filteredProducts.length === 0 ? (
                <p className="py-16 text-center text-sm text-gray-400">No products found</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                  {filteredProducts.map(product => {
                    const inCart = qtyInCart(product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addToCart(product)}
                        className={`relative text-left bg-white border rounded-lg p-2.5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
                          inCart ? 'border-red-400 ring-1 ring-red-200' : 'border-gray-200'
                        }`}
                      >
                        <p className="text-[11px] font-semibold text-gray-900 leading-tight line-clamp-2">{product.product_name}</p>
                        <p className="text-[11px] font-bold text-gray-900 mt-1">{money(Number(product.cost_price) || 0)}</p>
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

            {/* ───────── Receipt panel ───────── */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
              <div className="p-4 border-b border-gray-100 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Receiving Store <span className="text-red-500">*</span>
                  </label>
                  <select value={storeId} onChange={e => setStoreId(e.target.value)} className={fieldClass}>
                    <option value="">Select store...</option>
                    {stores.map(store => (
                      <option key={store.id} value={store.id}>
                        {store.store_name} ({store.store_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Reference <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="e.g. GRN-0012 or delivery note #"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-[140px] max-h-[360px] lg:max-h-none">
                {cart.length === 0 ? (
                  <div className="min-h-[140px] flex items-center justify-center text-xs text-gray-400 py-8">No products added yet</div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {cart.map(item => (
                      <li key={item.product_id} className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <p className="flex-1 min-w-0 text-xs font-semibold text-gray-900 truncate" title={item.product_name}>
                            {item.product_name}
                          </p>
                          <div className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                            <button type="button" onClick={() => changeQty(item.product_id, -1)} className="px-2 py-1 text-sm hover:bg-gray-50">
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => updateCartItem(item.product_id, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                              className="w-10 text-center text-xs py-1 border-x border-gray-200 focus:outline-none"
                            />
                            <button type="button" onClick={() => changeQty(item.product_id, 1)} className="px-2 py-1 text-sm hover:bg-gray-50">
                              +
                            </button>
                          </div>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.unit_cost}
                            onChange={e => updateCartItem(item.product_id, { unit_cost: Number(e.target.value) })}
                            title="Unit cost"
                            placeholder="Cost"
                            className="w-20 flex-shrink-0 border border-gray-200 rounded-lg px-2 py-1 text-xs text-right bg-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          />
                          <span className="w-20 flex-shrink-0 text-right text-xs font-semibold text-gray-900">
                            {money(item.quantity * item.unit_cost)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product_id)}
                            className="flex-shrink-0 text-gray-400 hover:text-red-600 text-base leading-none"
                            title="Remove"
                          >
                            ×
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 space-y-3 bg-gray-50/60 rounded-b-2xl">
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Items</span>
                    <span>{totalItems}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-900">Total cost</span>
                    <span className="text-xl font-bold text-gray-900">{money(totalCost)}</span>
                  </div>
                </div>

                {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">{error}</div>}
                {success && <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">{success}</div>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCart([]);
                      setReference('');
                      setError(null);
                    }}
                    disabled={submitting || cart.length === 0}
                    className="px-4 py-3 text-sm font-medium rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || cart.length === 0 || !storeId || !reference.trim()}
                    className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Receiving...' : 'Receive Products'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiveProductsPage;
