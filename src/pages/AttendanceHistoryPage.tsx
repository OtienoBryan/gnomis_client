import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiDownload, FiRefreshCw, FiUser, FiCalendar, FiX, FiChevronLeft, FiChevronRight, FiChevronDown, FiAlertCircle, FiEdit2, FiSave, FiPlus, FiLogOut } from 'react-icons/fi';
import api from '../services/api';

interface AttendanceRecord {
  id: number;
  staff_id: number;
  name: string;
  department: string;
  role?: string;
  photo_url?: string;
  date: string;
  checkin_time: string | null;
  checkout_time: string | null;
  corrected?: boolean;
  created_at: string;
  updated_at: string;
}

interface Staff {
  id: number;
  name: string;
  role: string;
  department: string;
  photo_url?: string;
  status?: number;
}

const PAGE_SIZE = 20;
const LUNCH_MINUTES = 30;

// Times are stored and shown as the wall-clock time that was entered (no UTC conversion).
// datetime-local value ("YYYY-MM-DDTHH:mm") -> "YYYY-MM-DD HH:mm:00"
const toDbTime = (v: string) => (v ? `${v.replace('T', ' ').slice(0, 16)}:00` : null);
// "YYYY-MM-DD HH:mm:ss" -> datetime-local value
const toInputTime = (v: string | null) => (v ? v.replace(' ', 'T').slice(0, 16) : '');

const AttendanceHistoryPage: React.FC = () => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [filteredAttendance, setFilteredAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10)); // Today's date as default
  const [endDate, setEndDate] = useState('');
  const [staffId, setStaffId] = useState('');
  const [department, setDepartment] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [showAbsent, setShowAbsent] = useState(false);
  const [checkoutRecord, setCheckoutRecord] = useState<AttendanceRecord | null>(null);
  const [checkoutTime, setCheckoutTime] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'department' | 'checkin'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editFormData, setEditFormData] = useState({
    checkin_time: '',
    checkout_time: '',
    date: ''
  });
  const [editLoading, setEditLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    staff_id: '',
    date: '',
    checkin_time: '',
    checkout_time: ''
  });
  const [addLoading, setAddLoading] = useState(false);
  const [monthlyRecordCount, setMonthlyRecordCount] = useState(0);
  const [existingRecordForDate, setExistingRecordForDate] = useState<AttendanceRecord | null>(null);
  const navigate = useNavigate();

  // Fetch staff list for filter dropdown
  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const response = await api.get('/staff');
        setStaffList(response.data);
      } catch (err) {
        setError('Failed to fetch staff list');
      }
    };
    fetchStaff();
  }, []);

  // Fetch attendance with filters
  useEffect(() => {
    const fetchAttendance = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (staffId) params.append('staff_id', staffId);
        const response = await api.get(`/attendance?${params.toString()}`);
        setAttendance(response.data);
        setPage(1); // Reset to first page on filter change
      } catch (err: any) {
        setError(err.response?.data?.message || err.message || 'Failed to fetch attendance data');
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, [startDate, endDate, staffId, reloadKey]);

  // Filter and sort attendance
  useEffect(() => {
    let filtered = [...attendance];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.role?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply department filter
    if (department) {
      filtered = filtered.filter(record => record.department === department);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'department':
          aValue = a.department.toLowerCase();
          bValue = b.department.toLowerCase();
          break;
        case 'checkin':
          aValue = a.checkin_time ? new Date(a.checkin_time).getTime() : 0;
          bValue = b.checkin_time ? new Date(b.checkin_time).getTime() : 0;
          break;
        default:
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredAttendance(filtered);
  }, [attendance, searchTerm, department, sortBy, sortOrder]);

  const paginated = filteredAttendance.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filteredAttendance.length / PAGE_SIZE);

  // Helper functions
  const getDepartments = () => {
    const departments = [...new Set(attendance.map(record => record.department))];
    return departments.filter(dept => dept && dept.trim() !== '');
  };

  const getStats = () => {
    const total = attendance.length;
    const present = attendance.filter(record => record.checkin_time).length;
    const absent = total - present;
    const late = attendance.filter(record => {
      if (!record.checkin_time) return false;
      const checkinTime = new Date(record.checkin_time);
      const expectedTime = new Date(String(record.date).slice(0, 10) + ' 08:00:00'); // 8:00 AM start time
      return checkinTime > expectedTime;
    }).length;
    
    return { total, present, absent, late };
  };

  const calculateTimeSpent = (checkin: string | null, checkout: string | null) => {
    if (!checkin) return null;
    const checkinTime = new Date(checkin);
    const checkoutTime = checkout ? new Date(checkout) : new Date();
    const diffMs = checkoutTime.getTime() - checkinTime.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
    return { hours, minutes };
  };

  // Working hours = time spent minus the 30-minute lunch break (never negative).
  // Records still checked in use the running time up to now.
  const workingMinutes = (record: AttendanceRecord): number | null => {
    const ts = calculateTimeSpent(record.checkin_time, record.checkout_time);
    if (!ts) return null;
    const total = ts.hours * 60 + ts.minutes;
    if (total < 0) return null;
    return Math.max(0, total - LUNCH_MINUTES);
  };

  const fmtMins = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;

  const getStatusText = (record: AttendanceRecord) => {
    if (!record.checkin_time) return 'Absent';
    if (!record.checkout_time) return 'Present (No Checkout)';
    return 'Present';
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStartDate(new Date().toISOString().slice(0, 10)); // Reset to today's date
    setEndDate('');
    setStaffId('');
    setDepartment('');
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Department', 'Role', 'Date', 'Check-in', 'Check-out', 'Status', 'Time Spent', 'Lunch (min)', 'Working Hours', 'Corrected'];
    const csvContent = [
      headers.join(','),
      ...filteredAttendance.map(record => {
        const timeSpent = calculateTimeSpent(record.checkin_time, record.checkout_time);
        const timeSpentStr = timeSpent ? `${timeSpent.hours}h ${timeSpent.minutes}m` : '-';
        return [
          record.name,
          record.department,
          record.role || '-',
          record.date,
          record.checkin_time ? new Date(record.checkin_time).toLocaleTimeString() : '-',
          record.checkout_time ? new Date(record.checkout_time).toLocaleTimeString() : '-',
          getStatusText(record),
          timeSpentStr,
          record.checkin_time ? LUNCH_MINUTES : 0,
          workingMinutes(record) === null ? '-' : fmtMins(workingMinutes(record) as number),
          record.corrected ? 'Yes' : 'No'
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Post check-out for a record that has a check-in but no check-out
  const openCheckoutModal = (record: AttendanceRecord) => {
    setCheckoutRecord(record);
    setCheckoutTime('');
    setCheckoutError(null);
  };

  const closeCheckoutModal = () => {
    setCheckoutRecord(null);
    setCheckoutTime('');
    setCheckoutError(null);
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutRecord || !checkoutTime) return;
    const day = String(checkoutRecord.date).slice(0, 10);
    const out = new Date(`${day}T${checkoutTime}`);
    if (checkoutRecord.checkin_time && out <= new Date(checkoutRecord.checkin_time)) {
      setCheckoutError('Check-out time must be after the check-in time');
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      await api.put(`/attendance/${checkoutRecord.id}`, {
        date: day,
        checkin_time: checkoutRecord.checkin_time,
        checkout_time: `${day} ${checkoutTime}:00`,
        checkout_only: true
      });
      closeCheckoutModal();
      setReloadKey(k => k + 1);
    } catch (err: any) {
      setCheckoutError(err.response?.data?.message || err.message || 'Failed to post check-out');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Edit functions
  const openEditModal = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditFormData({
      checkin_time: toInputTime(record.checkin_time),
      checkout_time: toInputTime(record.checkout_time),
      date: record.date
    });
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingRecord(null);
    setEditFormData({
      checkin_time: '',
      checkout_time: '',
      date: ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    setEditLoading(true);
    try {
      const updateData = {
        checkin_time: toDbTime(editFormData.checkin_time),
        checkout_time: toDbTime(editFormData.checkout_time),
        date: editFormData.date
      };

      await api.put(`/attendance/${editingRecord.id}`, updateData);

      // Refresh the data
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (staffId) params.append('staff_id', staffId);
      const refreshResponse = await api.get(`/attendance?${params.toString()}`);
      setAttendance(refreshResponse.data);

      closeEditModal();
    } catch (err: any) {
      setError(err.message || 'Failed to update attendance record');
    } finally {
      setEditLoading(false);
    }
  };

  // Add record functions
  const openAddModal = () => {
    setAddFormData({
      staff_id: '',
      date: new Date().toISOString().slice(0, 10), // Today's date as default
      checkin_time: '',
      checkout_time: ''
    });
    setMonthlyRecordCount(0);
    setShowAddModal(true);
  };

  // Check monthly record count for selected employee
  const checkMonthlyRecordCount = async (staffId: string, date: string) => {
    if (!staffId || !date) {
      setMonthlyRecordCount(0);
      return;
    }

    try {
      const recordDate = new Date(date);
      const year = recordDate.getFullYear();
      const month = recordDate.getMonth() + 1;
      
      const params = new URLSearchParams();
      params.append('staff_id', staffId);
      params.append('year', year.toString());
      params.append('month', month.toString());
      
      try {
        const response = await api.get(`/attendance/monthly-count?${params.toString()}`);
        setMonthlyRecordCount(response.data.count || 0);
      } catch (err) {
        // Ignore errors for monthly count
      }
    } catch (error) {
      console.error('Error checking monthly record count:', error);
      setMonthlyRecordCount(0);
    }
  };

  const checkExistingRecordForDate = async (staffId: string, date: string) => {
    if (!staffId || !date) {
      setExistingRecordForDate(null);
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('staff_id', staffId);
      params.append('date', date);
      
      const response = await api.get(`/attendance?${params.toString()}`);
      if (response.data.length > 0) {
        setExistingRecordForDate(response.data[0]);
      } else {
        setExistingRecordForDate(null);
      }
    } catch (error) {
      console.error('Error checking existing record:', error);
      setExistingRecordForDate(null);
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddFormData({
      staff_id: '',
      date: '',
      checkin_time: '',
      checkout_time: ''
    });
    setMonthlyRecordCount(0);
  };

  // Check monthly record count and existing records when staff or date changes
  useEffect(() => {
    if (addFormData.staff_id && addFormData.date) {
      checkMonthlyRecordCount(addFormData.staff_id, addFormData.date);
      checkExistingRecordForDate(addFormData.staff_id, addFormData.date);
    } else {
      setExistingRecordForDate(null);
    }
  }, [addFormData.staff_id, addFormData.date]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFormData.staff_id || !addFormData.date) return;

    setAddLoading(true);
    try {
      const createData = {
        staff_id: parseInt(addFormData.staff_id),
        date: addFormData.date,
        checkin_time: toDbTime(addFormData.checkin_time),
        checkout_time: toDbTime(addFormData.checkout_time)
      };

      await api.post('/attendance', createData);

      // Refresh the data
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (staffId) params.append('staff_id', staffId);
      const refreshResponse = await api.get(`/attendance?${params.toString()}`);
      setAttendance(refreshResponse.data);

      closeAddModal();
    } catch (err: any) {
      setError(err.message || 'Failed to create attendance record');
    } finally {
      setAddLoading(false);
    }
  };

  const stats = getStats();

  const todayStr = new Date().toISOString().slice(0, 10);
  const isoDay = (d: Date) => {
    const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return x.toISOString().slice(0, 10);
  };

  const quickRanges: { label: string; get: () => [string, string] }[] = [
    { label: 'Today', get: () => [isoDay(new Date()), isoDay(new Date())] },
    {
      label: 'Yesterday',
      get: () => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return [isoDay(d), isoDay(d)];
      }
    },
    {
      label: 'This week',
      get: () => {
        const d = new Date();
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return [isoDay(monday), isoDay(d)];
      }
    },
    {
      label: 'This month',
      get: () => {
        const d = new Date();
        return [isoDay(new Date(d.getFullYear(), d.getMonth(), 1)), isoDay(d)];
      }
    }
  ];

  const activeRange = quickRanges.find(r => {
    const [s, e] = r.get();
    return startDate === s && endDate === e;
  })?.label;

  const initials = (name: string) =>
    (name || '?').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

  const fmtTime = (v: string | null) =>
    v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  const isLate = (r: AttendanceRecord) =>
    !!r.checkin_time && new Date(r.checkin_time) > new Date(`${String(r.date).slice(0, 10)} 08:00:00`);

  const sortHeader = (key: 'date' | 'name' | 'department' | 'checkin', label: string) => (
    <button
      type="button"
      onClick={() => {
        setSortBy(key);
        setSortOrder(sortBy === key && sortOrder === 'asc' ? 'desc' : 'asc');
      }}
      className="inline-flex items-center gap-1 hover:text-gray-900"
    >
      {label}
      <span className={sortBy === key ? 'text-red-600' : 'text-gray-300'}>
        {sortBy === key ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );

  const pageNumbers = (): (number | '…')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const out: (number | '…')[] = [1];
    const from = Math.max(2, page - 1);
    const to = Math.min(totalPages - 1, page + 1);
    if (from > 2) out.push('…');
    for (let i = from; i <= to; i++) out.push(i);
    if (to < totalPages - 1) out.push('…');
    out.push(totalPages);
    return out;
  };

  // Absent = active staff (matching the employee/department filters) with no check-in in the selected period
  const checkedInIds = new Set(attendance.filter(r => r.checkin_time).map(r => r.staff_id));
  const notCheckedInStaff = staffList
    .filter(s =>
      (s.status === undefined || s.status === 1) &&
      (!staffId || String(s.id) === staffId) &&
      (!department || s.department === department) &&
      !checkedInIds.has(s.id)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const notCheckedIn = notCheckedInStaff.length;

  const statCards: { label: string; value: number; text: string; onClick?: () => void }[] = [
    { label: 'Present', value: stats.present, text: 'text-green-700' },
    { label: 'Not checked in', value: notCheckedIn, text: 'text-red-700', onClick: () => setShowAbsent(true) },
    { label: 'Late arrivals', value: stats.late, text: 'text-amber-700' }
  ];

  const inputCls =
    'block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-red-500 focus:border-red-500 text-sm';

  return (
    <div className="w-full min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance History</h1>
          <p className="mt-1 text-sm text-gray-500">
            {startDate && endDate && startDate === endDate
              ? `Records for ${new Date(startDate).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`
              : startDate
                ? `Records from ${new Date(startDate).toLocaleDateString()}${endDate ? ` to ${new Date(endDate).toLocaleDateString()}` : ' onwards'}`
                : 'All attendance records'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiChevronLeft className="w-4 h-4 mr-1" />
            Back
          </button>
          <button
            onClick={() => setReloadKey(k => k + 1)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiRefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50"
          >
            <FiDownload className="w-4 h-4 mr-1" />
            Export CSV
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            <FiPlus className="w-4 h-4 mr-1" />
            Add Record
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5 max-w-xl">
        {statCards.map(c => (
          <div
            key={c.label}
            onClick={c.onClick}
            role={c.onClick ? 'button' : undefined}
            tabIndex={c.onClick ? 0 : undefined}
            onKeyDown={c.onClick ? (e) => { if (e.key === 'Enter') c.onClick!(); } : undefined}
            title={c.onClick ? 'Click to view the list' : undefined}
            className={`bg-white rounded-lg border border-gray-200 px-3 py-2 ${c.onClick ? 'cursor-pointer hover:border-red-300 hover:shadow-sm transition' : ''}`}
          >
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{c.label}</p>
            <p className={`mt-0.5 text-xl font-bold leading-none ${c.text}`}>{loading ? '–' : c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters (collapsible) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <button
          type="button"
          onClick={() => setShowFilters(v => !v)}
          className="w-full flex items-center justify-between text-left"
          aria-expanded={showFilters}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
            <FiFilter className="w-4 h-4 text-gray-500" />
            Filters
            {(searchTerm || staffId || department || startDate !== todayStr || endDate) && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">Active</span>
            )}
          </span>
          <FiChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>

        {showFilters && (
        <div className="mt-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="inline-flex items-center text-xs font-medium text-gray-500 mr-1">
            Quick range
          </span>
          {quickRanges.map(r => (
            <button
              key={r.label}
              onClick={() => {
                const [s, e] = r.get();
                setStartDate(s);
                setEndDate(e);
              }}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                activeRange === r.label
                  ? 'bg-red-600 border-red-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              !startDate && !endDate
                ? 'bg-red-600 border-red-600 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All time
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="xl:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Name, department or role..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className={inputCls}>
              <option value="">All employees</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputCls}>
              <option value="">All departments</option>
              {getDepartments().map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>

        {(searchTerm || staffId || department || startDate !== todayStr || endDate) && (
          <div className="mt-3 flex justify-end">
            <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-800 font-medium">
              Reset filters
            </button>
          </div>
        )}
        </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 flex items-center text-sm">
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700 text-lg leading-none">×</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">
            Records <span className="text-gray-400 font-normal">({filteredAttendance.length})</span>
          </h3>
          {loading && <span className="text-xs text-gray-500">Loading…</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3">{sortHeader('name', 'Employee')}</th>
                <th className="px-5 py-3">{sortHeader('department', 'Department')}</th>
                <th className="px-5 py-3">{sortHeader('date', 'Date')}</th>
                <th className="px-5 py-3">{sortHeader('checkin', 'Check-in')}</th>
                <th className="px-5 py-3">Check-out</th>
                <th className="px-5 py-3">Time spent</th>
                <th className="px-5 py-3">Lunch</th>
                <th className="px-5 py-3">Working hours</th>
                <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {loading && paginated.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-5 py-4">
                      <div className="h-8 rounded bg-gray-100 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-14 text-center text-gray-500">
                    <FiCalendar className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                    <div className="text-base font-medium text-gray-700">No attendance records found</div>
                    <div className="text-sm">Try a different date range or clear the filters</div>
                  </td>
                </tr>
              ) : (
                paginated.map((record) => {
                  const timeSpent = calculateTimeSpent(record.checkin_time, record.checkout_time);
                  const late = isLate(record);
                  const status = !record.checkin_time ? 'absent' : !record.checkout_time ? 'open' : 'done';
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {record.photo_url ? (
                            <img
                              src={record.photo_url}
                              alt={record.name}
                              className="h-12 w-12 rounded-full object-cover border border-gray-200"
                            />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-semibold">
                              {initials(record.name)}
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{record.name}</div>
                            <div className="text-xs text-gray-500">{record.role || 'Employee'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">{record.department || '-'}</td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{record.date ? new Date(record.date).toLocaleDateString() : '-'}</div>
                        <div className="text-xs text-gray-500">
                          {record.date ? new Date(record.date).toLocaleDateString('en-US', { weekday: 'short' }) : ''}
                        </div>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {record.checkin_time ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900">{fmtTime(record.checkin_time)}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                late ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                              }`}
                            >
                              {late ? 'Late' : 'On time'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-900">
                        {fmtTime(record.checkout_time) || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-900">
                        {timeSpent ? (
                          <>
                            {`${timeSpent.hours}h ${timeSpent.minutes}m`}
                            {status === 'open' && <span className="ml-1 text-xs text-gray-400">(running)</span>}
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm text-gray-700">
                        {record.checkin_time ? `${LUNCH_MINUTES}m` : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {(() => {
                          const wh = workingMinutes(record);
                          return wh === null ? <span className="text-gray-400">-</span> : fmtMins(wh);
                        })()}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap text-right">
                        {record.checkin_time && !record.checkout_time && (
                          <button
                            onClick={() => openCheckoutModal(record)}
                            className="mr-1 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                            title="Post check-out time"
                          >
                            <FiLogOut className="w-3.5 h-3.5" />
                            Check-out
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(record)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          title="Edit attendance record"
                        >
                          <FiEdit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Showing <span className="font-medium">{(page - 1) * PAGE_SIZE + 1}</span>–
              <span className="font-medium">{Math.min(page * PAGE_SIZE, filteredAttendance.length)}</span> of{' '}
              <span className="font-medium">{filteredAttendance.length}</span>
            </p>
            <nav className="inline-flex items-center gap-1" aria-label="Pagination">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronLeft className="h-4 w-4" />
              </button>
              {pageNumbers().map((n, i) =>
                n === '…' ? (
                  <span key={`e${i}`} className="px-2 text-gray-400">…</span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`min-w-[2.25rem] px-2 py-1.5 rounded-lg border text-sm font-medium ${
                      n === page
                        ? 'bg-red-600 border-red-600 text-white'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {n}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiChevronRight className="h-4 w-4" />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Not checked in list */}
      {showAbsent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowAbsent(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Not checked in ({notCheckedInStaff.length})</h3>
                <p className="text-xs text-gray-500">
                  {startDate && endDate && startDate === endDate
                    ? new Date(startDate).toLocaleDateString()
                    : startDate
                      ? `${new Date(startDate).toLocaleDateString()}${endDate ? ` – ${new Date(endDate).toLocaleDateString()}` : ' onwards'}`
                      : 'All time'}
                </p>
              </div>
              <button onClick={() => setShowAbsent(false)} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto divide-y divide-gray-100">
              {notCheckedInStaff.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-gray-500">Everyone has checked in.</p>
              ) : (
                notCheckedInStaff.map(s => (
                  <div key={s.id} className="px-6 py-3 flex items-center gap-3">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt={s.name} className="h-10 w-10 rounded-full object-cover border border-gray-200" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-semibold">
                        {initials(s.name)}
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-500">{[s.role, s.department].filter(Boolean).join(' • ')}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Check-out Modal */}
      {checkoutRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => !checkoutLoading && closeCheckoutModal()}>
          <form
            onSubmit={handleCheckoutSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-xl shadow-2xl max-w-md w-full"
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Post Check-out</h3>
              <button type="button" onClick={closeCheckoutModal} className="text-gray-400 hover:text-gray-600">
                <FiX className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                {checkoutRecord.photo_url ? (
                  <img src={checkoutRecord.photo_url} alt={checkoutRecord.name} className="h-12 w-12 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-semibold">
                    {initials(checkoutRecord.name)}
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-900">{checkoutRecord.name}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(checkoutRecord.date).toLocaleDateString()} • Checked in at {fmtTime(checkoutRecord.checkin_time)}
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Time *</label>
                <input
                  type="time"
                  value={checkoutTime}
                  onChange={(e) => setCheckoutTime(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500 text-sm"
                  required
                />
              </div>
              {checkoutTime && checkoutRecord.checkin_time && (() => {
                const out = new Date(`${String(checkoutRecord.date).slice(0, 10)}T${checkoutTime}`);
                const spent = Math.floor((out.getTime() - new Date(checkoutRecord.checkin_time).getTime()) / 60000);
                if (spent <= 0) return null;
                return (
                  <div className="bg-red-50 rounded-lg p-3 text-sm text-red-800 flex justify-between">
                    <span>Time spent: <strong>{fmtMins(spent)}</strong></span>
                    <span>Working hours (less {LUNCH_MINUTES}m lunch): <strong>{fmtMins(Math.max(0, spent - LUNCH_MINUTES))}</strong></span>
                  </div>
                );
              })()}
              {checkoutError && <p className="text-sm text-red-600">{checkoutError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button type="button" onClick={closeCheckoutModal} disabled={checkoutLoading} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Cancel
              </button>
              <button type="submit" disabled={checkoutLoading || !checkoutTime} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                {checkoutLoading ? 'Saving...' : 'Post Check-out'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Edit Attendance Record</h3>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="px-6 py-6 space-y-4">
              {/* Employee Info (Read-only) */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Employee Information</h4>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0 h-10 w-10">
                    {editingRecord.photo_url ? (
                      <img
                        src={editingRecord.photo_url}
                        alt={editingRecord.name}
                        className="h-10 w-10 rounded-full object-cover border-2 border-gray-200"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center border-2 border-gray-200">
                        <FiUser className="h-5 w-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{editingRecord.name}</div>
                    <div className="text-sm text-gray-500">{editingRecord.role || 'Employee'} • {editingRecord.department}</div>
                  </div>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={editFormData.date}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                  required
                />
              </div>

              {/* Check-in Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Time</label>
                <input
                  type="datetime-local"
                  value={editFormData.checkin_time}
                  onChange={(e) => setEditFormData({ ...editFormData, checkin_time: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Leave empty if employee was absent</p>
              </div>

              {/* Check-out Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Time</label>
                <input
                  type="datetime-local"
                  value={editFormData.checkout_time}
                  onChange={(e) => setEditFormData({ ...editFormData, checkout_time: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Leave empty if employee didn't check out</p>
              </div>

              {/* Time Spent Preview */}
              {editFormData.checkin_time && (
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-red-900">Time Spent Preview:</div>
                  <div className="text-sm text-red-700">
                    {(() => {
                      const checkin = new Date(editFormData.checkin_time);
                      const checkout = editFormData.checkout_time ? new Date(editFormData.checkout_time) : new Date();
                      const diffMs = checkout.getTime() - checkin.getTime();
                      const hours = Math.floor(diffMs / (1000 * 60 * 60));
                      const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
                      return `${hours}h ${minutes}m`;
                    })()}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                >
                  {editLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <FiSave className="w-4 h-4 mr-2" />
                      Update Record
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Record Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Add Attendance Record</h3>
              <button
                onClick={closeAddModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="px-6 py-6 space-y-4">
              {/* Staff Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                <select
                  value={addFormData.staff_id}
                  onChange={(e) => setAddFormData({ ...addFormData, staff_id: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                  required
                >
                  <option value="">Select Employee</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.role}) - {staff.department}
                    </option>
                  ))}
                </select>
                {/* Existing Record Warning */}
                {existingRecordForDate && (
                  <div className="mt-2 p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex items-center">
                      <FiAlertCircle className="w-4 h-4 text-red-500 mr-2" />
                      <div className="text-sm text-red-900">
                        <strong>Record Already Exists:</strong> This employee already has an attendance record for {new Date(existingRecordForDate.date).toLocaleDateString()}.
                      </div>
                    </div>
                    <div className="text-xs text-red-700 mt-2">
                      Check-in: {existingRecordForDate.checkin_time ? new Date(existingRecordForDate.checkin_time).toLocaleTimeString() : 'Not recorded'} | 
                      Check-out: {existingRecordForDate.checkout_time ? new Date(existingRecordForDate.checkout_time).toLocaleTimeString() : 'Not recorded'}
                    </div>
                    <div className="text-xs text-red-700 mt-1">
                      Please choose a different date or edit the existing record.
                    </div>
                  </div>
                )}

                {/* Monthly Record Count Info */}
                {addFormData.staff_id && addFormData.date && !existingRecordForDate && (
                  <div className="mt-2 p-3 bg-red-50 rounded-lg">
                    <div className="text-sm text-red-900">
                      <strong>Total Records:</strong> {monthlyRecordCount}/2 for this month
                    </div>
                    {monthlyRecordCount >= 2 && (
                      <div className="text-sm text-red-600 mt-1">
                        ⚠️ Maximum records reached. Cannot add more records for this employee this month.
                      </div>
                    )}
                    <div className="text-xs text-red-700 mt-2">
                      <strong>Note:</strong> Manually created records are marked as "Corrected" but still count toward the monthly limit.
                    </div>
                  </div>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={addFormData.date}
                  onChange={(e) => setAddFormData({ ...addFormData, date: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                  required
                />
              </div>

              {/* Check-in Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in Time</label>
                <input
                  type="datetime-local"
                  value={addFormData.checkin_time}
                  onChange={(e) => setAddFormData({ ...addFormData, checkin_time: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Leave empty if employee was absent</p>
              </div>

              {/* Check-out Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out Time</label>
                <input
                  type="datetime-local"
                  value={addFormData.checkout_time}
                  onChange={(e) => setAddFormData({ ...addFormData, checkout_time: e.target.value })}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Leave empty if employee didn't check out</p>
              </div>

              {/* Time Spent Preview */}
              {addFormData.checkin_time && (
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-sm font-medium text-red-900">Time Spent Preview:</div>
                  <div className="text-sm text-red-700">
                    {(() => {
                      const checkin = new Date(addFormData.checkin_time);
                      const checkout = addFormData.checkout_time ? new Date(addFormData.checkout_time) : new Date();
                      const diffMs = checkout.getTime() - checkin.getTime();
                      const hours = Math.floor(diffMs / (1000 * 60 * 60));
                      const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
                      return `${hours}h ${minutes}m`;
                    })()}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  disabled={addLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addLoading || !addFormData.staff_id || !addFormData.date || monthlyRecordCount >= 2 || !!existingRecordForDate}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
                >
                  {addLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : existingRecordForDate ? (
                    <>
                      <FiX className="w-4 h-4 mr-2" />
                      Record Exists
                    </>
                  ) : monthlyRecordCount >= 2 ? (
                    <>
                      <FiX className="w-4 h-4 mr-2" />
                      Monthly Limit Reached
                    </>
                  ) : (
                    <>
                      <FiPlus className="w-4 h-4 mr-2" />
                      Create Record (Corrected)
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceHistoryPage; 