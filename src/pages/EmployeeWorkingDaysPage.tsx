import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Filter,
  Search,
  Download
} from 'lucide-react';
import api from '../services/api';
import StaffLeavesModal from '../components/StaffLeavesModal';
import HolidaysWeekendsModal from '../components/HolidaysWeekendsModal';
import AbsentDaysModal from '../components/AbsentDaysModal';

interface WorkingDaysRecord {
  id: number;
  name: string;
  department: string;
  effective_working_days: number;
  days_present: number;
  leave_days: number;
  absent_days: number;
  absent_dates?: string[];
  absent_holiday_dates?: string[];
  holidays: number;
  attendance_pct: string;
}

interface AttendanceStats {
  totalEmployees: number;
  avgAttendance: number;
  totalPresentDays: number;
  totalAbsentDays: number;
}

const EmployeeWorkingDaysPage: React.FC = () => {
  const navigate = useNavigate();
  const [records, setRecords] = useState<WorkingDaysRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<WorkingDaysRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [staffId, setStaffId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [staffList, setStaffList] = useState<{ id: number; name: string }[]>([]);
  const [leavesFor, setLeavesFor] = useState<{ id: number; name: string } | null>(null);
  const [showHolidays, setShowHolidays] = useState(false);
  const [absentFor, setAbsentFor] = useState<WorkingDaysRecord | null>(null);
  const [stats, setStats] = useState<AttendanceStats>({
    totalEmployees: 0,
    avgAttendance: 0,
    totalPresentDays: 0,
    totalAbsentDays: 0
  });

  // Calculate stats whenever records change
  useEffect(() => {
    if (records.length > 0) {
      const totalEmployees = records.length;
      const totalAttendancePercent = records.reduce((sum, record) => {
        const percent = record.attendance_pct === 'N/A' ? 0 : parseFloat(record.attendance_pct);
        return sum + percent;
      }, 0);
      const avgAttendance = totalAttendancePercent / totalEmployees;
      const totalPresentDays = records.reduce((sum, record) => sum + record.days_present, 0);
      const totalAbsentDays = records.reduce((sum, record) => sum + record.absent_days, 0);

      setStats({
        totalEmployees,
        avgAttendance,
        totalPresentDays,
        totalAbsentDays
      });
    }
  }, [records]);

  // Filter records based on search and department filter
  useEffect(() => {
    let filtered = records;

    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.department.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (departmentFilter) {
      filtered = filtered.filter(record => record.department === departmentFilter);
    }

    setFilteredRecords(filtered);
  }, [records, searchTerm, departmentFilter]);

  useEffect(() => {
    // Fetch staff list for filter dropdown
    api.get('/staff')
      .then(res => {
        // Ensure we always have an array
        const data = Array.isArray(res.data) ? res.data : [];
        setStaffList(data.map((s: any) => ({ id: s.id, name: s.name })));
      })
      .catch(() => setStaffList([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    if (staffId) params.append('staff_id', staffId);

    api.get(`/employee-working-days?${params.toString()}`)
      .then(res => {
        // Ensure we always have an array
        const data = Array.isArray(res.data) ? res.data : [];
        setRecords(data);
      })
      .catch(err => {
        console.error('Error fetching working days:', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch working days');
        setRecords([]);
      })
      .finally(() => setLoading(false));
  }, [month, staffId]);

  const viewStaffAttendance = (staffId: number) => {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const endDate = `${year}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    navigate(`/attendance-history?staff_id=${staffId}&start_date=${startDate}&end_date=${endDate}`);
  };

  const getDepartments = () => {
    const departments = [...new Set(records.map(record => record.department))];
    return departments.sort();
  };

  const getAttendanceBadge = (percentage: string) => {
    if (percentage === 'N/A') return 'bg-gray-100 text-gray-800';
    const percent = parseFloat(percentage);
    if (percent >= 90) return 'bg-green-100 text-green-800';
    if (percent >= 75) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Department', 'Working Days', 'Present Days', 'Leave Days', 'Absent Days', 'Holidays & Weekends', 'Attendance %'];
    const csvContent = [
      headers.join(','),
      ...filteredRecords.map(record => [
        record.name,
        record.department,
        record.effective_working_days,
        record.days_present,
        record.leave_days,
        record.absent_days,
        record.holidays || 0,
        record.attendance_pct
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employee-working-days-${month}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employee Working Days</h1>
            <p className="text-sm text-gray-600 mt-1">Track attendance and working days for all employees</p>
          </div>
          <button
            onClick={exportToCSV}
            disabled={filteredRecords.length === 0}
            className="inline-flex items-center px-4 py-2 text-sm border border-transparent font-medium rounded-md text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 hidden">
          <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-md flex items-center justify-center">
                  <Users className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Employees</p>
                <p className="text-lg font-bold text-gray-900">{stats.totalEmployees}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-100 rounded-md flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Average Attendance</p>
                <p className="text-lg font-bold text-gray-900">{stats.avgAttendance.toFixed(1)}%</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-emerald-100 rounded-md flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Present Days</p>
                <p className="text-lg font-bold text-gray-900">{stats.totalPresentDays}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-md p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-md flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Absent Days</p>
                <p className="text-lg font-bold text-gray-900">{stats.totalAbsentDays}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Filters</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
              <input
                type="month"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-red-500 focus:border-transparent transition-colors"
                value={month}
                onChange={e => setMonth(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff Member</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-red-500 focus:border-transparent transition-colors"
                value={staffId}
                onChange={e => setStaffId(e.target.value)}
              >
                <option value="">All Staff</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-red-500 focus:border-transparent transition-colors"
                value={departmentFilter}
                onChange={e => setDepartmentFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {getDepartments().map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  className="w-full border border-gray-300 rounded-md pl-10 pr-3 py-2 text-sm focus:ring-1 focus:ring-red-500 focus:border-transparent transition-colors"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-md shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-center">
              <Clock className="h-5 w-5 text-red-500 animate-spin mr-2" />
              <span className="text-sm text-gray-600">Loading employee data...</span>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-md shadow-sm border border-red-200 p-4">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
              <span className="text-sm text-red-600 font-medium">{error}</span>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Employee Working Days Report
                </h3>
                <span className="text-sm text-gray-500">
                  Showing {filteredRecords.length} of {records.length} employees
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Working Days
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Present Days
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Leave Days
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Absent Days
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Holidays &amp; Weekends
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Attendance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center">
                          <Users className="h-8 w-8 text-gray-300 mb-2" />
                          <h3 className="text-sm font-medium text-gray-900 mb-1">No employees found</h3>
                          <p className="text-sm text-gray-500">Try adjusting your filters or search term.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{record.name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {record.department}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {record.effective_working_days}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => viewStaffAttendance(record.id)}
                            className="text-green-600 hover:text-green-800 hover:underline"
                            title="View attendance details"
                          >
                            {record.days_present}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => setLeavesFor({ id: record.id, name: record.name })}
                            className="text-red-600 hover:text-red-800 hover:underline"
                            title="View all leaves for this staff member"
                          >
                            {record.leave_days}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => setAbsentFor(record)}
                            className="text-red-600 hover:text-red-800 hover:underline"
                            title="View the absent days"
                          >
                            {record.absent_days}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                          <button
                            type="button"
                            onClick={() => setShowHolidays(true)}
                            className="text-purple-600 hover:text-purple-800 hover:underline"
                            title="View the holidays and weekends in this month"
                          >
                            {record.holidays || 0}
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getAttendanceBadge(record.attendance_pct)}`}>
                            {record.attendance_pct === 'N/A' ? 'N/A' : `${record.attendance_pct}%`}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <StaffLeavesModal staff={leavesFor} month={month} onClose={() => setLeavesFor(null)} />
      <HolidaysWeekendsModal month={showHolidays ? month : null} onClose={() => setShowHolidays(false)} />
      <AbsentDaysModal
        staff={absentFor ? { id: absentFor.id, name: absentFor.name, absent_dates: absentFor.absent_dates || [], absent_holiday_dates: absentFor.absent_holiday_dates } : null}
        month={month}
        onClose={() => setAbsentFor(null)}
        onViewAttendance={(id) => { setAbsentFor(null); viewStaffAttendance(id); }}
      />
    </div>
  );
};

export default EmployeeWorkingDaysPage;
