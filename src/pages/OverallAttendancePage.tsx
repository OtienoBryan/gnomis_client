import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DateTime } from 'luxon';
import { salesService, Country, SalesRep } from '../services/salesService';
import { Calendar, Users, MapPin, TrendingUp, Filter, Download, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

// Configure axios for authentication
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
  date: string; // yyyy-mm-dd
  checkInTime?: string;
  checkoutTime?: string;
  time?: string;
  status?: number;
  notes?: string;
  latitude?: number;
  longitude?: number;
}

interface AttendanceRow {
  date: string;
  clientsVisited: number;
  activeSalesReps: number;
}

interface DashboardStats {
  totalActiveDays: number;
  totalClientsVisited: number;
  totalActiveSalesReps: number;
  averageAttendanceRate: number;
}

const OverallAttendancePage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Default to current month (first day to today - never a future date)
  const todayISO = DateTime.now().toISODate() as string;
  const defaultStart = DateTime.now().startOf('month').toISODate();
  const defaultEnd = todayISO;
  
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [journeyPlans, setJourneyPlans] = useState<JourneyPlan[]>([]);
  const [totalClients, setTotalClients] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRow[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [pendingCountry, setPendingCountry] = useState('');
  const [defaultCountrySet, setDefaultCountrySet] = useState<boolean>(false);
  const [pendingStartDate, setPendingStartDate] = useState(defaultStart);
  const [pendingEndDate, setPendingEndDate] = useState(defaultEnd);

  // Data fetching
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(null); // Reset error state
    
    console.log('OverallAttendancePage: Starting data fetch...');
    console.log('API_BASE_URL:', API_BASE_URL);
    
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    // Build sales reps URL with leader_id filter if user is a leader
    const salesRepsParams = new URLSearchParams();
    salesRepsParams.append('status', '1');
    if (user?.role === 'leader' && user?.id) {
      salesRepsParams.append('leader_id', user.id.toString());
    }
    
    // Build journey plans URL with team_leader_id filter if user is a leader
    const journeyPlansParams = new URLSearchParams(params);
    if (user?.role === 'leader' && user?.id) {
      journeyPlansParams.append('team_leader_id', user.id.toString());
    }
    
    Promise.all([
      axios.get(`${API_BASE_URL}/login-history?${params.toString()}`, { headers: getAuthHeaders(), signal }),
      axios.get(`${API_BASE_URL}/journey-plans?${journeyPlansParams.toString()}`, { headers: getAuthHeaders(), signal }),
      axios.get(`${API_BASE_URL}/clients?limit=1`, { headers: getAuthHeaders(), signal }),
      salesService.getCountries(),
      axios.get(`${API_BASE_URL}/sales-reps?${salesRepsParams.toString()}`, { headers: getAuthHeaders(), signal }),
    ])
      .then(([loginRes, journeyRes, clientsRes, countriesRes, salesRepsRes]) => {
                 console.log('OverallAttendancePage: Data fetch successful');
         console.log('Login history count:', loginRes.data?.length || 0);
         console.log('Journey plans count:', journeyRes.data?.length || 0);
        console.log('Clients meta:', clientsRes.data);
         console.log('Countries count:', countriesRes?.length || 0);
         // Handle sales reps response format
         const salesRepsData = salesRepsRes.data?.success && Array.isArray(salesRepsRes.data.data)
           ? salesRepsRes.data.data
           : (Array.isArray(salesRepsRes.data) ? salesRepsRes.data : []);
         console.log('Sales reps count:', salesRepsData?.length || 0);
         
         // Debug: Check sample data structures
         if (loginRes.data?.length > 0) {
           console.log('Sample login history:', loginRes.data[0]);
         }
         if (journeyRes.data?.length > 0) {
           console.log('Sample journey plan:', journeyRes.data[0]);
         }
         if (salesRepsData?.length > 0) {
           console.log('Sample sales rep:', salesRepsData[0]);
         }
        
        console.log('Setting state with data:');
        console.log('loginRes.data type:', typeof loginRes.data, 'isArray:', Array.isArray(loginRes.data));
        console.log('journeyRes.data type:', typeof journeyRes.data, 'isArray:', Array.isArray(journeyRes.data));
        console.log('clientsRes.data type:', typeof clientsRes.data, 'isArray:', Array.isArray(clientsRes.data));
        console.log('salesRepsRes type:', typeof salesRepsData, 'isArray:', Array.isArray(salesRepsData));
        
        setLoginHistory(Array.isArray(loginRes.data) ? loginRes.data : []);
        setJourneyPlans(Array.isArray(journeyRes.data) ? journeyRes.data : []);
        // Only set total clients; defer full list until modal open
        const total = typeof clientsRes.data?.total === 'number'
          ? clientsRes.data.total
          : (Array.isArray(clientsRes.data?.data) ? clientsRes.data.data.length : (Array.isArray(clientsRes.data) ? clientsRes.data.length : 0));
        setTotalClients(total || 0);
        setCountries(Array.isArray(countriesRes) ? countriesRes : []);
        setSalesReps(Array.isArray(salesRepsData) ? salesRepsData : []);
        setLoading(false);
      })
      .catch((error) => {
        if (error?.name === 'CanceledError') return; // ignore cancellations
        console.error('Error fetching overall attendance data:', error);
        setError(`Failed to fetch data: ${error.response?.data?.message || error.message || 'Unknown error'}`);
        setLoading(false);
      });
    return () => controller.abort();
  }, [startDate, endDate, user?.role, user?.id]);

  // Fetch user's country and set default filter
  useEffect(() => {
    const fetchUserCountry = async () => {
      // Only set default once
      if (!user?.id || countries.length === 0 || defaultCountrySet) return;
      
      try {
        const response = await axios.get(`${API_BASE_URL}/staff/${user.id}`, { headers: getAuthHeaders() });
        const staffData = response.data;
        const userCountry = staffData.country || staffData.country_id || staffData.countryId;
        
        // Set default country based on user's country
        // country = 1 means Kenya, country = 2 means Tanzania
        if (userCountry === 1 || userCountry === '1') {
          // Find Kenya in the countries list
          const kenyaCountry = countries.find(c => c.id === 1 || c.name.toLowerCase() === 'kenya');
          if (kenyaCountry) {
            setSelectedCountry(kenyaCountry.name);
            setPendingCountry(kenyaCountry.name);
          } else {
            setSelectedCountry('Kenya');
            setPendingCountry('Kenya');
          }
          setDefaultCountrySet(true);
        } else if (userCountry === 2 || userCountry === '2') {
          // Find Tanzania in the countries list
          const tanzaniaCountry = countries.find(c => c.id === 2 || c.name.toLowerCase() === 'tanzania');
          if (tanzaniaCountry) {
            setSelectedCountry(tanzaniaCountry.name);
            setPendingCountry(tanzaniaCountry.name);
          } else {
            setSelectedCountry('Tanzania');
            setPendingCountry('Tanzania');
          }
          setDefaultCountrySet(true);
        }
      } catch (error) {
        console.error('Failed to fetch user country:', error);
        // Default to Kenya if we can't fetch the user's country
        if (!defaultCountrySet) {
          setSelectedCountry('Kenya');
          setPendingCountry('Kenya');
          setDefaultCountrySet(true);
        }
      }
    };
    
    fetchUserCountry();
  }, [user?.id, countries, defaultCountrySet]);

  // Build attendance rows
  useEffect(() => {
    // Safety check: ensure all required arrays are properly initialized
    if (!Array.isArray(loginHistory) || !Array.isArray(journeyPlans) || !Array.isArray(salesReps)) {
      console.log('Arrays not ready yet:', {
        loginHistory: Array.isArray(loginHistory),
        journeyPlans: Array.isArray(journeyPlans),
        salesReps: Array.isArray(salesReps)
      });
      return;
    }
    
    const dateMap: Record<string, { salesReps: Set<number>; clients: Set<number> }> = {};

    // Generate all dates in the range (startDate to endDate) and initialize with empty sets.
    // Never generate rows for future dates, even if endDate was set beyond today.
    if (startDate && endDate) {
      const cappedEndDate = endDate > todayISO ? todayISO : endDate;
      const start = new Date(startDate);
      const end = new Date(cappedEndDate);
      const currentDate = new Date(start);

      while (currentDate <= end) {
        const dateStr = currentDate.toISOString().slice(0, 10);
        dateMap[dateStr] = { salesReps: new Set(), clients: new Set<number>() };
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // Count active sales reps and clients directly from JourneyPlan records
    // Only count JourneyPlan records with status = 1 or 2
    if (Array.isArray(journeyPlans)) {
      journeyPlans.forEach(jp => {
        // Only process JourneyPlan records with status = 1 or 2
        if (jp.status !== 1 && jp.status !== 2) return;
        
        const date = jp.date.slice(0, 10);
        // Initialize if not already in dateMap (in case date is outside range)
        if (!dateMap[date]) dateMap[date] = { salesReps: new Set(), clients: new Set<number>() };
        
        // Count sales rep if they have a JourneyPlan with status = 1 or 2 on this date
        if (jp.userId) {
          dateMap[date].salesReps.add(jp.userId);
        }
        
        // Count clients that have been actually visited (have checkInTime)
        if (jp.checkInTime) {
          dateMap[date].clients.add(jp.clientId);
        }
      });
    } else {
      console.warn('journeyPlans is not an array:', journeyPlans);
    }
    
    console.log('Total journey plans:', journeyPlans.length);
    console.log('Journey plans with status 1 or 2:', journeyPlans.filter(jp => jp.status === 1 || jp.status === 2).length);
    
    const rows: AttendanceRow[] = Object.entries(dateMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, { salesReps, clients }]) => ({
        date,
        clientsVisited: clients.size,
        activeSalesReps: salesReps.size,
      }));
     console.log('Generated attendance rows:', rows.length);
     console.log('Sample attendance row:', rows[0]);
     console.log('Journey plans with checkInTime:', journeyPlans.filter(jp => jp.checkInTime).length);
    setAttendanceRows(rows);
  }, [loginHistory, journeyPlans, salesReps, startDate, endDate, todayISO]);

  // Filter rows
  const filteredRows = attendanceRows.filter(row => {
    if (row.date > todayISO) return false;
    if (startDate && row.date < startDate) return false;
    if (endDate && row.date > endDate) return false;
    if (selectedCountry) {
      // Get sales rep IDs from the selected country
      const countryRepIds = Array.isArray(salesReps) ? salesReps.filter(rep => rep.country === selectedCountry).map(rep => rep.id) : [];
      // Get active sales rep IDs from JourneyPlan (status = 1 or 2)
      const activeRepIds = Array.isArray(journeyPlans) 
        ? [...new Set(journeyPlans.filter(jp => jp.userId && (jp.status === 1 || jp.status === 2)).map(jp => jp.userId as number))]
        : [];
      // Only include reps that are from the selected country AND have active JourneyPlans
      const repIds = countryRepIds.filter(id => activeRepIds.includes(id));
      const loginReps = Array.isArray(loginHistory) ? loginHistory.filter(lh => lh.sessionStart && lh.sessionStart.slice(0, 10) === row.date).map(lh => lh.userId) : [];
      if (!loginReps.some(id => repIds.includes(id))) return false;
    }
    return true;
  });

  // Helper function to format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    
    // Extract date from the ISO string without any conversion
    // Format: 2025-09-07T20:08:29.590Z
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const monthIndex = parseInt(month) - 1;
      const dayIndex = new Date(parseInt(year), monthIndex, parseInt(day)).getDay();
      return `${dayNames[dayIndex]}, ${parseInt(day)} ${monthNames[monthIndex]} ${year}`;
    }
    
    const date = DateTime.fromISO(dateString);
    if (!date.isValid) {
      // Try parsing with native Date as fallback
      const nativeDate = new Date(dateString);
      if (isNaN(nativeDate.getTime())) {
        return 'Invalid Date';
      }
      // Format manually to show the exact time from database
      const year = nativeDate.getUTCFullYear();
      const month = nativeDate.getUTCMonth() + 1;
      const day = nativeDate.getUTCDate();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayOfWeek = dayNames[nativeDate.getUTCDay()];
      return `${dayOfWeek}, ${day} ${monthNames[month - 1]} ${year}`;
    }
    // Display without timezone conversion
    return date.toFormat('EEE, d MMM yyyy');
  };


  // Helper functions for filter modal
  const openFilterModal = () => {
    setPendingCountry(selectedCountry);
    setPendingStartDate(startDate);
    setPendingEndDate(endDate);
    setFilterModalOpen(true);
  };

  const applyFilters = () => {
    setSelectedCountry(pendingCountry);
    setStartDate(pendingStartDate);
    setEndDate(pendingEndDate);
    setFilterModalOpen(false);
  };

  const clearFilters = () => {
    // Reset to current month (start of month through today - never a future date)
    const currentMonthStart = DateTime.now().startOf('month').toISODate();
    const currentMonthEnd = todayISO;
    setPendingCountry('');
    setPendingStartDate(currentMonthStart);
    setPendingEndDate(currentMonthEnd);
    setSelectedCountry('');
    setStartDate(currentMonthStart);
    setEndDate(currentMonthEnd);
    setFilterModalOpen(false);
  };

  // Helper function to export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Clients Visited', 'Active Sales Reps'];
    const rows = filteredRows.map(row => [
      row.date,
      row.clientsVisited,
      row.activeSalesReps
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'overall_attendance.csv';
    link.click();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-red-50 text-red-600 p-1.5 rounded-md">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Overall Attendance</h1>
              <p className="text-[10px] text-gray-500 mt-0.5">Comprehensive sales team performance and client visit tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportToCSV}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-md text-xs font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Download className="h-3 w-3 mr-1.5" />
              Export CSV
            </button>
            <button
              onClick={openFilterModal}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
            >
              <Filter className="h-3 w-3 mr-1.5" />
              Filter
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-red-600 border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="bg-white border border-gray-200 rounded-md text-center py-16">
            <h3 className="text-sm font-medium text-red-900">Error Loading Data</h3>
            <p className="mt-2 text-xs text-red-600 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Dashboard Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div className="bg-white border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-red-50 text-red-600 p-1.5 rounded-md">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Active Days</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{filteredRows.length}</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-green-50 text-green-600 p-1.5 rounded-md">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Active Sales Reps</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{Array.isArray(salesReps) ? salesReps.filter(rep => rep.status === 1).length : 0}</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-purple-50 text-purple-600 p-1.5 rounded-md">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Clients</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{totalClients.toLocaleString()}</p>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="bg-orange-50 text-orange-600 p-1.5 rounded-md">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider">Total Visits</p>
                </div>
                <p className="text-lg font-bold text-gray-900">
                  {filteredRows.reduce((sum, row) => sum + row.clientsVisited, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
              <div className="px-3 py-2.5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-gray-900">Daily Attendance Overview</h3>
                  <p className="mt-0.5 text-[10px] text-gray-500">Showing {filteredRows.length} days of attendance data</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span className="text-[9px] text-gray-500">Sales Reps</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-[9px] text-gray-500">Client Visits</span>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden">
                {filteredRows.length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-xs font-medium text-gray-900 mb-1">No Data Available</h3>
                    <p className="text-[10px] text-gray-500">No attendance data found for the selected date range.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                            Clients Visited
                          </th>
                          <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                            Active Sales Reps
                          </th>
                          <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                            Activity Level
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredRows.map((row, index) => {
                          const activityLevel = row.clientsVisited > 50 ? 'High' :
                                               row.clientsVisited > 20 ? 'Medium' : 'Low';
                          const activityColor = activityLevel === 'High' ? 'bg-green-100 text-green-800' :
                                               activityLevel === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                                               'bg-red-100 text-red-800';

                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                                {formatDate(row.date)}
                              </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center">
                                <button
                                  onClick={() => navigate(`/overall-attendance/visits/${row.date}`)}
                                className="text-xs font-semibold text-green-600 hover:text-green-800 transition-colors cursor-pointer"
                                >
                                  {row.clientsVisited.toLocaleString()} Visits
                                </button>
                              </td>
                            <td className="px-3 py-2 whitespace-nowrap text-center">
                                 <button
                                   onClick={() => navigate(`/overall-attendance/reps/${row.date}`)}
                                  className="text-xs font-semibold text-red-600 hover:text-red-800 transition-colors cursor-pointer"
                                 >
                                   {row.activeSalesReps.toLocaleString()} Reps
                                 </button>
                               </td>
                              <td className="px-3 py-2 whitespace-nowrap text-center">
                                <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${activityColor}`}>
                                  {activityLevel}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

          </>
        )}
      </div>


        {/* Filter Modal */}
        {filterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
            <div className="bg-white rounded-md shadow-lg w-full max-w-sm p-4 relative">
              <button
                onClick={() => setFilterModalOpen(false)}
                className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
              <h2 className="text-sm font-bold text-gray-900 mb-3">Filter Options</h2>

              <div className="space-y-2.5">
                <div>
                  <label htmlFor="countryFilter" className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Country
                  </label>
                  <select
                    id="countryFilter"
                    value={pendingCountry}
                    onChange={(e) => setPendingCountry(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  >
                    <option value="">All Countries</option>
                    {countries.map(country => (
                      <option key={country.id} value={country.name}>{country.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="startDate" className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={pendingStartDate}
                    max={todayISO}
                    onChange={(e) => setPendingStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={pendingEndDate}
                    max={todayISO}
                    onChange={(e) => setPendingEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-3">
                <button
                  onClick={clearFilters}
                  className="px-3 py-1.5 rounded bg-gray-100 text-gray-700 text-xs font-medium hover:bg-gray-200"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setFilterModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-white border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={applyFilters}
                  className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-semibold shadow hover:bg-red-700"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default OverallAttendancePage; 