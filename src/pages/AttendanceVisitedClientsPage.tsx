import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { DateTime } from 'luxon';
import { SalesRep } from '../services/salesService';
import { MapPin, ArrowLeft, FileText, Navigation, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface JourneyPlan {
  id: number;
  userId: number;
  clientId: number;
  date: string;
  checkInTime?: string;
  checkoutTime?: string;
  status?: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

interface Client {
  id: number;
  name: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = DateTime.fromISO(dateString);
  if (date.isValid) return date.toFormat('EEE, d MMM yyyy');
  const nativeDate = new Date(dateString);
  if (isNaN(nativeDate.getTime())) return 'Invalid Date';
  return nativeDate.toDateString();
};

const formatDateTime = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = DateTime.fromISO(dateString);
  if (date.isValid) return date.toFormat('d MMM yyyy, HH:mm');
  const nativeDate = new Date(dateString);
  if (isNaN(nativeDate.getTime())) return 'Invalid Date';
  return nativeDate.toLocaleString();
};

const calculateTimeSpent = (startTime: string, endTime?: string): string => {
  if (!startTime) return 'N/A';
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return diffHours > 0 ? `${diffHours}h ${diffMinutes}m` : `${diffMinutes}m`;
};

const AttendanceVisitedClientsPage: React.FC = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journeyPlans, setJourneyPlans] = useState<JourneyPlan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [salesRepFilter, setSalesRepFilter] = useState<string>('');
  const [selectedVisit, setSelectedVisit] = useState<{ client: Client; journeyPlan: JourneyPlan; salesRep: SalesRep | null } | null>(null);

  useEffect(() => {
    if (!date) return;
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null);

    const journeyPlansParams = new URLSearchParams({ startDate: date, endDate: date });
    if (user?.role === 'leader' && user?.id) {
      journeyPlansParams.append('team_leader_id', user.id.toString());
    }
    const salesRepsParams = new URLSearchParams({ status: '1' });
    if (user?.role === 'leader' && user?.id) {
      salesRepsParams.append('leader_id', user.id.toString());
    }

    Promise.all([
      axios.get(`${API_BASE_URL}/journey-plans?${journeyPlansParams.toString()}`, { headers: getAuthHeaders(), signal }),
      axios.get(`${API_BASE_URL}/clients?limit=10000`, { headers: getAuthHeaders(), signal }),
      axios.get(`${API_BASE_URL}/sales-reps?${salesRepsParams.toString()}`, { headers: getAuthHeaders(), signal }),
    ])
      .then(([journeyRes, clientsRes, salesRepsRes]) => {
        const salesRepsData = salesRepsRes.data?.success && Array.isArray(salesRepsRes.data.data)
          ? salesRepsRes.data.data
          : (Array.isArray(salesRepsRes.data) ? salesRepsRes.data : []);
        const clientsList = Array.isArray(clientsRes.data?.data) ? clientsRes.data.data : (Array.isArray(clientsRes.data) ? clientsRes.data : []);
        setJourneyPlans(Array.isArray(journeyRes.data) ? journeyRes.data : []);
        setClients(clientsList);
        setSalesReps(Array.isArray(salesRepsData) ? salesRepsData : []);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'CanceledError') return;
        console.error('Error fetching visited clients:', err);
        setError(`Failed to fetch data: ${err.response?.data?.message || err.message || 'Unknown error'}`);
        setLoading(false);
      });

    return () => controller.abort();
  }, [date, user?.role, user?.id]);

  const clientsForDate = useMemo(() => {
    const visitedClientIds = journeyPlans
      .filter(jp => jp.checkInTime && (jp.status === 1 || jp.status === 2))
      .map(jp => jp.clientId);
    const uniqueClientIds = [...new Set(visitedClientIds)];
    return uniqueClientIds
      .map(clientId => clients.find(c => c.id === clientId))
      .filter((c): c is Client => c !== undefined);
  }, [journeyPlans, clients]);

  const filteredClients = useMemo(() => {
    if (!salesRepFilter) return clientsForDate;
    const salesRepId = parseInt(salesRepFilter);
    return clientsForDate.filter(client =>
      journeyPlans.some(jp =>
        jp.clientId === client.id &&
        jp.userId === salesRepId &&
        jp.checkInTime &&
        (jp.status === 1 || jp.status === 2)
      )
    );
  }, [clientsForDate, salesRepFilter, journeyPlans]);

  const handleVisitClick = (client: Client, journeyPlan: JourneyPlan) => {
    const salesRep = salesReps.find(sr => sr.id === journeyPlan.userId) || null;
    setSelectedVisit({ client, journeyPlan, salesRep });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="bg-green-50 text-green-600 p-1.5 rounded-md">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Clients Visited</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">{date && formatDate(date)}</p>
            </div>
          </div>
          <select
            value={salesRepFilter}
            onChange={(e) => setSalesRepFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">All Sales Reps</option>
            {salesReps.map((rep) => (
              <option key={rep.id} value={rep.id}>{rep.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-green-600 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="bg-white border border-gray-200 rounded-md text-center py-16">
            <h3 className="text-sm font-medium text-red-900">Error Loading Data</h3>
            <p className="mt-2 text-xs text-red-600">{error}</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            {filteredClients.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-xs font-semibold text-gray-900 mb-1.5">
                  {salesRepFilter ? 'No Clients Visited by Selected Sales Rep' : 'No Clients Visited'}
                </h3>
                <p className="text-[10px] text-gray-500">
                  {salesRepFilter
                    ? 'No clients were visited by the selected sales representative on this date.'
                    : 'No clients were visited on this date.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Client Name</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Sales Rep</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Check-in</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Check-out</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Time Spent</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredClients.map((client) => {
                      const clientJourneyPlans = journeyPlans.filter(jp =>
                        jp.clientId === client.id && jp.checkInTime
                      );
                      return clientJourneyPlans.map((jp, jpIndex) => {
                        const salesRep = salesReps.find(sr => sr.id === jp.userId) || null;
                        return (
                          <tr
                            key={`${client.id}-${jpIndex}`}
                            className="hover:bg-green-50 transition-colors cursor-pointer"
                            onClick={() => handleVisitClick(client, jp)}
                          >
                            <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">{client.name}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-center">
                              <div className="text-xs font-medium text-gray-900">{salesRep ? salesRep.name : 'Unknown'}</div>
                              <div className="text-[9px] text-gray-500 truncate max-w-[150px]">{salesRep ? salesRep.email : ''}</div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center text-xs text-gray-700">
                              {jp.checkInTime ? new Date(jp.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center text-xs text-gray-700">
                              {jp.checkoutTime ? new Date(jp.checkoutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Still Active'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center">
                              <div className="text-xs font-semibold text-red-600">
                                {jp.checkInTime ? calculateTimeSpent(jp.checkInTime, jp.checkoutTime) : 'N/A'}
                              </div>
                              <div className="text-[9px] text-gray-500">{jp.checkoutTime ? 'Completed' : 'In Progress'}</div>
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center">
                              <div className="inline-flex items-center gap-1.5">
                                {jp.latitude && jp.longitude ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${jp.latitude},${jp.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center px-2 py-1 rounded text-[9px] font-medium text-white bg-red-600 hover:bg-red-700"
                                  >
                                    <MapPin className="h-2.5 w-2.5 mr-1" />
                                    Map
                                  </a>
                                ) : (
                                  <span
                                    className="inline-flex items-center px-2 py-1 rounded text-[9px] font-medium text-gray-400 bg-gray-100 cursor-not-allowed"
                                    title="No GPS coordinates recorded for this visit"
                                  >
                                    <MapPin className="h-2.5 w-2.5 mr-1" />
                                    Map
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/my-reports', {
                                      state: {
                                        clientId: client.id,
                                        clientName: client.name,
                                        salesRepId: jp.userId,
                                        salesRepName: salesRep?.name || 'Unknown',
                                        visitDate: date
                                      }
                                    });
                                  }}
                                  className="inline-flex items-center px-2 py-1 rounded text-[9px] font-medium text-white bg-green-600 hover:bg-green-700"
                                >
                                  <FileText className="h-2.5 w-2.5 mr-1" />
                                  Reports
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-3 py-2 border-t border-gray-200 text-[10px] text-gray-500">
              Showing {filteredClients.length} clients visited{date && ` on ${formatDate(date)}`}
              {salesRepFilter && ` by ${salesReps.find(rep => rep.id === parseInt(salesRepFilter))?.name || 'Selected Sales Rep'}`}
            </div>
          </div>
        )}
      </div>

      {/* Location Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-md shadow-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 bg-red-600 text-white rounded-t-md">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4" />
                <div>
                  <h2 className="text-sm font-bold">Visit Location</h2>
                  <p className="text-[10px] text-red-100">{selectedVisit.client.name}</p>
                </div>
              </div>
              <button onClick={() => setSelectedVisit(null)} className="text-white hover:text-red-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                <div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Sales Representative</p>
                  <p className="text-gray-900 mt-0.5">{selectedVisit.salesRep?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Check-in Time</p>
                  <p className="text-gray-900 mt-0.5">{formatDateTime(selectedVisit.journeyPlan.checkInTime || '')}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Check-out Time</p>
                  <p className="text-gray-900 mt-0.5">
                    {selectedVisit.journeyPlan.checkoutTime ? formatDateTime(selectedVisit.journeyPlan.checkoutTime) : 'Still Active'}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Notes</p>
                  <p className="text-gray-900 mt-0.5">{selectedVisit.journeyPlan.notes || 'No notes'}</p>
                </div>
              </div>

              {selectedVisit.journeyPlan.latitude && selectedVisit.journeyPlan.longitude ? (
                <div className="border-t border-gray-200 pt-3">
                  <p className="text-xs text-gray-600 mb-2">
                    Coordinates: {selectedVisit.journeyPlan.latitude}, {selectedVisit.journeyPlan.longitude}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={`https://www.google.com/maps?q=${selectedVisit.journeyPlan.latitude},${selectedVisit.journeyPlan.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700"
                    >
                      <MapPin className="h-3.5 w-3.5 mr-1.5" />
                      Google Maps
                    </a>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${selectedVisit.journeyPlan.latitude}&mlon=${selectedVisit.journeyPlan.longitude}&zoom=15`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                    >
                      <Navigation className="h-3.5 w-3.5 mr-1.5" />
                      OpenStreetMap
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 border-t border-gray-200 pt-3">No GPS coordinates recorded for this visit.</p>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedVisit(null)}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-red-600 hover:bg-red-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceVisitedClientsPage;
