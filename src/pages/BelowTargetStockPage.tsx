import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { storeService } from '../services/storeService';
import { StoreInventory } from '../types/financial';

const BelowTargetStockPage: React.FC = () => {
  const [inventory, setInventory] = useState<StoreInventory[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const invRes = await storeService.getAllStoresInventory();
        if (invRes.success) setInventory(invRes.data || []);
      } catch {
        setError('Failed to fetch inventory data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const belowTarget = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Sum quantity across all stores, one row per product
    const byProduct = new Map<number, any>();
    inventory.forEach(item => {
      const existing = byProduct.get(item.product_id);
      if (existing) {
        existing.quantity += Number(item.quantity) || 0;
      } else {
        byProduct.set(item.product_id, { ...item, quantity: Number(item.quantity) || 0 });
      }
    });
    return Array.from(byProduct.values())
      .filter(item => {
        const target = Number(item.target_stock_qty) || 0;
        return target > 0 && item.quantity < target;
      })
      .filter(item =>
        !q ||
        (item.product_name || '').toLowerCase().includes(q) ||
        (item.product_code || '').toLowerCase().includes(q)
      )
      .map(item => ({
        ...item,
        target: Number(item.target_stock_qty),
        shortfall: Number(item.target_stock_qty) - item.quantity,
      }))
      .sort((a, b) => b.shortfall - a.shortfall);
  }, [inventory, search]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-3"></div>
          <p className="text-xs text-gray-600 font-medium">Loading inventory data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Products Below Target Quantity</h1>
          <p className="text-xs text-gray-500">
            {belowTarget.length} product{belowTarget.length === 1 ? '' : 's'} with total stock (all stores) below the target
          </p>
        </div>
        <Link
          to="/store-inventory"
          className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 shadow-sm"
        >
          Back to Store Inventory
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search product name or code"
          className="border border-gray-300 rounded-md px-3 py-1.5 text-xs w-64 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {error && <div className="mb-3 text-xs text-red-600">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
        {belowTarget.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No products are below their target quantity.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Product', 'Category', 'Available Qty', 'Target Qty', 'Shortfall', 'Unit'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {belowTarget.map(item => (
                <tr key={item.product_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="text-xs font-semibold text-gray-900">{item.product_name}</div>
                    
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{item.category || 'N/A'}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-semibold text-gray-900">
                    {Number(item.quantity).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">{item.target.toLocaleString()}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                      -{item.shortfall.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{item.unit_of_measure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default BelowTargetStockPage;
