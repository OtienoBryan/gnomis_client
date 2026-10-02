import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../config/api';

interface Vehicle {
  id: number;
  registration_number: string;
  model: string;
  consumption: number | null;
  status: number;
  created_at: string;
}

const VehiclesPage: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchVehicles = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_CONFIG.getUrl('/vehicles'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setVehicles(data.data || []);
      } else {
        setError('Failed to fetch vehicles');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? vehicles.filter((v) =>
          [v.registration_number, v.model].some((val) => val.toLowerCase().includes(q))
        )
      : vehicles;
  }, [vehicles, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const handleDelete = async (vehicleId: number) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      const res = await fetch(API_CONFIG.getUrl(`/vehicles/${vehicleId}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetchVehicles();
    } catch (err: any) {
      alert('Failed to delete vehicle: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Vehicles</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">Manage delivery vehicles and their fuel consumption</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search vehicles..."
                value={search}
                onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                className="pl-7 pr-3 py-1.5 border border-gray-300 rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-red-500 w-56"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">🔎</span>
            </div>
            <button
              className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold shadow-sm"
              onClick={() => navigate('/vehicles/new')}
            >
              + Add Vehicle
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Vehicles</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{vehicles.length}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-md p-3">
            <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Filtered</p>
            <p className="text-lg font-bold text-gray-900 mt-0.5">{filtered.length}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-600 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Registration Number</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Model</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Consumption (km/l)</th>
                    <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-xs text-gray-500">No vehicles found</td>
                    </tr>
                  ) : (
                    paged.map((vehicle) => (
                      <tr key={vehicle.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{vehicle.registration_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{vehicle.model}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{vehicle.consumption != null ? Number(vehicle.consumption).toFixed(1) : 'N/A'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-center">
                          <button
                            className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-[9px] font-semibold"
                            onClick={() => handleDelete(vehicle.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination */}
          {!loading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200">
              <div className="text-[10px] text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  className="px-2.5 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Prev
                </button>
                <span className="text-[10px] text-gray-600">Page {currentPage} / {totalPages}</span>
                <button
                  className="px-2.5 py-1 border border-gray-300 rounded text-[10px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default VehiclesPage;
