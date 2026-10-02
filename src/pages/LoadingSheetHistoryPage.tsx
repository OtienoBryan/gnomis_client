import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadingSheetService, LoadingSheetSummary, LoadingSheetStatus } from '../services/financialService';

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

const LoadingSheetHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [sheets, setSheets] = useState<LoadingSheetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSheets = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await loadingSheetService.getAll();
        if (res.success) {
          setSheets(res.data || []);
        } else {
          setError(res.error || 'Failed to fetch loading sheets');
        }
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch loading sheets');
      } finally {
        setLoading(false);
      }
    };
    fetchSheets();
  }, []);

  const formatDateTime = (d: string) => (d ? new Date(d).toLocaleString() : 'N/A');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-sm font-bold text-gray-900">Loading Sheet History</h1>
            <p className="text-[10px] text-gray-500 mt-0.5">All loading sheets created for driver/vehicle dispatch</p>
          </div>
          <button
            onClick={() => navigate('/loading-sheet')}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs font-semibold shadow-sm"
          >
            + New Loading Sheet
          </button>
        </div>

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
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Sheet #</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sheets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-500">No loading sheets found</td>
                    </tr>
                  ) : (
                    sheets.map((sheet) => (
                      <tr
                        key={sheet.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/loading-sheet/${sheet.id}`)}
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{sheet.sheet_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{sheet.driver_name || 'N/A'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">{sheet.vehicle_registration_number || 'N/A'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700 text-center">{sheet.order_count}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${STATUS_BADGE_CLASSES[sheet.status]}`}>
                            {STATUS_LABELS[sheet.status]}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-[10px] text-gray-500">{formatDateTime(sheet.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadingSheetHistoryPage;
