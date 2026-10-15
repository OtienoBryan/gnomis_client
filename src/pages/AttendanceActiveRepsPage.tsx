import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { DateTime } from 'luxon';
import { salesService, SalesRep, Country } from '../services/salesService';
import { Users, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

interface LoginHistory {
  id: number;
  userId: number;
  sessionStart: string;
  sessionEnd?: string;
}

interface JourneyPlan {
  id: number;
  userId: number;
  clientId: number;
  date: string;
  checkInTime?: string;
  status?: number;
}

type ActiveRep = SalesRep & { sessionStart: string; sessionEnd?: string; clientsVisited: number };

const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = DateTime.fromISO(dateString);
  if (date.isValid) return date.toFormat('EEE, d MMM yyyy');
  const nativeDate = new Date(dateString);
  if (isNaN(nativeDate.getTime())) return 'Invalid Date';
  return nativeDate.toDateString();
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

const AttendanceActiveRepsPage: React.FC = () => {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [journeyPlans, setJourneyPlans] = useState<JourneyPlan[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryFilter, setCountryFilter] = useState('');

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
      axios.get(`${API_BASE_URL}/login-history?startDate=${date}&endDate=${date}`, { headers: getAuthHeaders(), signal }),
      axios.get(`${API_BASE_URL}/sales-reps?${salesRepsParams.toString()}`, { headers: getAuthHeaders(), signal }),
      salesService.getCountries().catch(() => []),
    ])
      .then(([journeyRes, loginRes, salesRepsRes, countriesData]) => {
        const salesRepsData = salesRepsRes.data?.success && Array.isArray(salesRepsRes.data.data)
          ? salesRepsRes.data.data
          : (Array.isArray(salesRepsRes.data) ? salesRepsRes.data : []);
        setJourneyPlans(Array.isArray(journeyRes.data) ? journeyRes.data : []);
        setLoginHistory(Array.isArray(loginRes.data) ? loginRes.data : []);
        setSalesReps(Array.isArray(salesRepsData) ? salesRepsData : []);
        setCountries(Array.isArray(countriesData) ? countriesData : []);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'CanceledError') return;
        console.error('Error fetching active sales reps:', err);
        setError(`Failed to fetch data: ${err.response?.data?.message || err.message || 'Unknown error'}`);
        setLoading(false);
      });

    return () => controller.abort();
  }, [date, user?.role, user?.id]);

  const activeReps: ActiveRep[] = useMemo(() => {
    const activeRepIds = new Set(
      journeyPlans
        .filter(jp => (jp.status === 1 || jp.status === 2) && jp.userId)
        .map(jp => jp.userId)
    );

    return Array.from(activeRepIds)
      .map((userId): ActiveRep | null => {
        const rep = salesReps.find(sr => sr.id === userId);
        if (!rep) return null;

        const login = loginHistory.find(lh => lh.userId === userId);
        const clientsVisited = journeyPlans.filter(jp =>
          jp.userId === rep.id && jp.checkInTime && (jp.status === 1 || jp.status === 2)
        ).length;

        return {
          ...rep,
          sessionStart: login?.sessionStart || '',
          sessionEnd: login?.sessionEnd,
          clientsVisited
        };
      })
      .filter((rep): rep is ActiveRep => rep !== null);
  }, [journeyPlans, loginHistory, salesReps]);

  const filteredReps = useMemo(() => {
    return countryFilter ? activeReps.filter(rep => rep.country === countryFilter) : activeReps;
  }, [activeReps, countryFilter]);

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
            <div className="bg-red-50 text-red-600 p-1.5 rounded-md">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Active Sales Representatives</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">{date && formatDate(date)}</p>
            </div>
          </div>
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <option value="">All Countries</option>
            {countries.map((country) => (
              <option key={country.id} value={country.name}>{country.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="bg-white border border-gray-200 rounded-md text-center py-16">
            <h3 className="text-sm font-medium text-red-900">Error Loading Data</h3>
            <p className="mt-2 text-xs text-red-600">{error}</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
            {filteredReps.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-xs font-semibold text-gray-900 mb-1.5">
                  {countryFilter ? `No Sales Representatives from ${countryFilter}` : 'No Sales Representatives'}
                </h3>
                <p className="text-[10px] text-gray-500">
                  {countryFilter ? `No sales representatives found for ${countryFilter} on this date.` : 'No sales representatives found for this date.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Sales Representative</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Clients Visited</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Session Start</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Session End</th>
                      <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Time Spent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredReps.map((rep, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                          {rep.name}
                          
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-center">
                          <div className="text-xs font-semibold text-green-600">{rep.clientsVisited}</div>
                          <div className="text-[9px] text-gray-500">visits</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-center text-xs text-gray-700">
                          {rep.sessionStart ? new Date(rep.sessionStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-center text-xs text-gray-700">
                          {rep.sessionEnd ? new Date(rep.sessionEnd).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-semibold text-red-600">
                          {calculateTimeSpent(rep.sessionStart, rep.sessionEnd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="px-3 py-2 border-t border-gray-200 text-[10px] text-gray-500">
              Showing {filteredReps.length} active sales representatives{countryFilter && ` from ${countryFilter}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AttendanceActiveRepsPage;
