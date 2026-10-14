import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  shortExpiryReportService, 
  ShortExpiryReport, 
  ShortExpiryReportFilters 
} from '../services/shortExpiryReportService';
import { Calendar, ArrowLeft, Filter, Download, Search, Package, Hash, Calendar as CalendarIcon, Building2, User } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Always-visible filters. Every control applies immediately (the page refetches on change).
const FilterPanel: React.FC<{
  startDate: string;
  endDate: string;
  selectedOutlet: string;
  selectedSalesRep: string;
  minDaysLeft: string;
  maxDaysLeft: string;
  outlets: { id: number; name: string }[];
  salesReps: { id: number; name: string }[];
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onOutletChange: (outlet: string) => void;
  onSalesRepChange: (salesRep: string) => void;
  onMinDaysLeftChange: (value: string) => void;
  onMaxDaysLeftChange: (value: string) => void;
  onResetFilters: () => void;
}> = ({
  startDate,
  endDate,
  selectedOutlet,
  selectedSalesRep,
  minDaysLeft,
  maxDaysLeft,
  outlets,
  salesReps,
  onStartDateChange,
  onEndDateChange,
  onOutletChange,
  onSalesRepChange,
  onMinDaysLeftChange,
  onMaxDaysLeftChange,
  onResetFilters
}) => {
  const inputCls =
    'w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-500';
  const labelCls = 'block text-[10px] text-gray-600 mb-1';

  return (
    <div className="mb-4 bg-white border border-gray-200 rounded-lg shadow-sm p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <Filter className="w-3 h-3" />
          Filters
        </div>
        <button
          type="button"
          onClick={onResetFilters}
          className="px-2.5 py-1 bg-white border border-gray-300 rounded-md text-[10px] text-gray-700 hover:bg-gray-50"
        >
          Reset
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <div>
          <label htmlFor="filter-start-date" className={labelCls}>From Date</label>
          <input
            type="date"
            id="filter-start-date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="filter-end-date" className={labelCls}>To Date</label>
          <input
            type="date"
            id="filter-end-date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="filter-outlet" className={labelCls}>Outlet</label>
          <select
            id="filter-outlet"
            value={selectedOutlet}
            onChange={(e) => onOutletChange(e.target.value)}
            className={inputCls}
          >
            <option value="all">All Outlets</option>
            {outlets.map((outlet) => (
              <option key={outlet.id} value={outlet.name}>{outlet.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-sales-rep" className={labelCls}>Sales Representative</label>
          <select
            id="filter-sales-rep"
            value={selectedSalesRep}
            onChange={(e) => onSalesRepChange(e.target.value)}
            className={inputCls}
          >
            <option value="all">All Sales Reps</option>
            {salesReps.map((salesRep) => (
              <option key={salesRep.id} value={salesRep.name}>{salesRep.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="filter-min-days" className={labelCls}>Min days to expiry</label>
          <input
            type="number"
            id="filter-min-days"
            value={minDaysLeft}
            onChange={(e) => onMinDaysLeftChange(e.target.value)}
            placeholder="e.g. 0"
            className={inputCls}
            min={0}
          />
        </div>
        <div>
          <label htmlFor="filter-max-days" className={labelCls}>Max days to expiry</label>
          <input
            type="number"
            id="filter-max-days"
            value={maxDaysLeft}
            onChange={(e) => onMaxDaysLeftChange(e.target.value)}
            placeholder="e.g. 30"
            className={inputCls}
            min={0}
          />
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-gray-500">
        The days-to-expiry range narrows the rows on the current page (expired items count as 0 days left).
      </p>
    </div>
  );
};

const ShortExpiryReportPage: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ShortExpiryReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedOutlet, setSelectedOutlet] = useState<string>('all');
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [outlets, setOutlets] = useState<{ id: number; name: string }[]>([]);
  const [salesReps, setSalesReps] = useState<{ id: number; name: string }[]>([]);
  const [minDaysLeft, setMinDaysLeft] = useState<string>('');
  const [maxDaysLeft, setMaxDaysLeft] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [totalValue, setTotalValue] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const fetchReports = async (filters?: ShortExpiryReportFilters) => {
    setLoading(true);
    setError(null);
    try {
      const response = await shortExpiryReportService.getAll({
        ...filters,
        page: pagination.page,
        limit: pagination.limit
      });
      setReports(response.data);
      setPagination(response.pagination);
      setTotalValue(Number(response.summary?.totalValue) || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch short expiry reports');
    }
    setLoading(false);
  };

  const fetchOutlets = async () => {
    try {
      const outletsData = await shortExpiryReportService.getOutlets();
      setOutlets(outletsData);
    } catch (err: any) {
      console.error('Failed to fetch outlets:', err);
    }
  };

  const fetchSalesReps = async () => {
    try {
      const salesRepsData = await shortExpiryReportService.getSalesReps();
      setSalesReps(salesRepsData);
    } catch (err: any) {
      console.error('Failed to fetch sales reps:', err);
    }
  };

  useEffect(() => {
    fetchOutlets();
    fetchSalesReps();
  }, []);

  useEffect(() => {
    const filters: ShortExpiryReportFilters = { startDate, endDate };
    if (selectedOutlet !== 'all') {
      filters.outlet = selectedOutlet;
    }
    if (selectedSalesRep !== 'all') {
      filters.salesRep = selectedSalesRep;
    }
    if (searchQuery.trim()) {
      filters.search = searchQuery.trim();
    }
    fetchReports(filters);
  }, [startDate, endDate, selectedOutlet, selectedSalesRep, searchQuery, pagination.page, pagination.limit]);

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleEndDateChange = (date: string) => {
    setEndDate(date);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleOutletChange = (outlet: string) => {
    setSelectedOutlet(outlet);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSalesRepChange = (salesRep: string) => {
    setSelectedSalesRep(salesRep);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    setSelectedOutlet('all');
    setSelectedSalesRep('all');
    setSearchQuery('');
    setMinDaysLeft('');
    setMaxDaysLeft('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  function calculateDaysToExpiry(expiryDate: string): { days: number; status: 'expired' | 'critical' | 'warning' | 'good' } {
    if (!expiryDate) return { days: 0, status: 'good' };
    
    try {
      const expiry = new Date(expiryDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiry.setHours(0, 0, 0, 0);
      
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return { days: Math.abs(diffDays), status: 'expired' };
      } else if (diffDays <= 30) {
        return { days: diffDays, status: 'critical' };
      } else if (diffDays <= 89) {
        return { days: diffDays, status: 'warning' };
      } else {
        return { days: diffDays, status: 'good' };
      }
    } catch {
      return { days: 0, status: 'good' };
    }
  }

  // Subtotal for a row = quantity x the product's selling price
  const rowSubtotal = (report: { quantity: number | string; unitPrice?: number | string | null }) =>
    (Number(report.quantity) || 0) * (Number(report.unitPrice) || 0);

  const formatMoney = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const applyDaysFilter = (list: ShortExpiryReport[]) => {
    const hasMin = minDaysLeft !== '';
    const hasMax = maxDaysLeft !== '';
    if (!hasMin && !hasMax) return list;

    const min = hasMin ? parseInt(minDaysLeft, 10) : 0;
    const max = hasMax ? parseInt(maxDaysLeft, 10) : Number.POSITIVE_INFINITY;
    if ((hasMin && isNaN(min)) || (hasMax && isNaN(max))) return list;

    return list.filter((report) => {
      const { days, status } = calculateDaysToExpiry(report.expiry_date);
      const effectiveDaysLeft = status === 'expired' ? 0 : days;
      return effectiveDaysLeft >= min && effectiveDaysLeft <= max;
    });
  };

  const filteredReports = useMemo(
    () => applyDaysFilter(reports),
    [reports, minDaysLeft, maxDaysLeft]
  );

  // The days-to-expiry filter only narrows the rows on the current page, so when it is active the
  // card totals those rows instead of the server-side grand total.
  const daysFilterActive = minDaysLeft !== '' || maxDaysLeft !== '';
  const cardTotal = daysFilterActive
    ? filteredReports.reduce((sum, r) => sum + rowSubtotal(r), 0)
    : totalValue;

  // PDF of every record matching the current filters (not just this page): all columns plus the total
  const handleExportPDF = async () => {
    setExportingPdf(true);
    setError(null);
    try {
      const filters: ShortExpiryReportFilters = { startDate, endDate };
      if (selectedOutlet !== 'all') filters.outlet = selectedOutlet;
      if (selectedSalesRep !== 'all') filters.salesRep = selectedSalesRep;
      if (searchQuery.trim()) filters.search = searchQuery.trim();

      // limit -1 asks the server for all matching rows
      const response = await shortExpiryReportService.getAll({ ...filters, page: 1, limit: -1 });
      const rows = applyDaysFilter(response.data);
      const grandTotal = rows.reduce((sum, r) => sum + rowSubtotal(r), 0);

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFontSize(14);
      doc.text('Short Expiry Report', 8, 12);
      doc.setFontSize(8);
      doc.setTextColor(100);
      const filterBits = [
        `Created: ${startDate || 'all'} to ${endDate || 'all'}`,
        selectedOutlet !== 'all' ? `Outlet: ${selectedOutlet}` : null,
        selectedSalesRep !== 'all' ? `Sales rep: ${selectedSalesRep}` : null,
        searchQuery.trim() ? `Search: ${searchQuery.trim()}` : null,
        minDaysLeft !== '' || maxDaysLeft !== '' ? `Days to expiry: ${minDaysLeft || 0} - ${maxDaysLeft || 'any'}` : null,
      ].filter(Boolean);
      doc.text(filterBits.join('   |   '), 8, 17);
      doc.text(`Generated ${new Date().toLocaleString()}   |   ${rows.length} record${rows.length === 1 ? '' : 's'}`, 8, 21);
      doc.setTextColor(0);
      doc.setFontSize(10);
      doc.text(`Total value: KES ${formatMoney(grandTotal)}`, pageWidth - 8, 12, { align: 'right' });

      const head = [[
        'Region', 'Outlet', 'Outlet Type', 'Outlet Account', 'Sales Rep', 'Product Name', 'Qty', 'Unit Price',
        'Subtotal', 'Batch No.', 'SKU', 'Expiry Date', 'Days to Expiry', 'Created At', 'Comment',
      ]];
      const body = rows.map((r) => {
        const { days, status } = calculateDaysToExpiry(r.expiry_date);
        const hasPrice = r.unitPrice != null && r.unitPrice !== '';
        return [
          r.regionName || 'N/A',
          r.outletName || 'N/A',
          r.outletTypeName || 'N/A',
          r.outletAccountName || 'N/A',
          r.salesRepName || 'N/A',
          r.product_name || '',
          String(r.quantity ?? ''),
          hasPrice ? formatMoney(Number(r.unitPrice)) : 'N/A',
          hasPrice ? formatMoney(rowSubtotal(r)) : 'N/A',
          r.batch_number || '',
          r.productSku || 'N/A',
          r.expiry_date || '',
          status === 'expired' ? `Expired ${days}d ago` : `${days}d left`,
          formatDate(r.createdAt),
          r.comment || '-',
        ];
      });
      const foot = [[
        { content: 'Total', colSpan: 8, styles: { halign: 'right' as const } },
        { content: formatMoney(grandTotal), styles: { halign: 'right' as const } },
        { content: '', colSpan: 6 },
      ]];

      autoTable(doc, {
        head,
        body,
        foot,
        startY: 25,
        margin: { left: 8, right: 8 },
        styles: { fontSize: 6, cellPadding: 1.2, overflow: 'linebreak' },
        headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: 'bold' },
        footStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold' },
        showFoot: 'lastPage',
        columnStyles: {
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          14: { cellWidth: 30 },
        },
      });

      doc.save(`short-expiry-report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err: any) {
      setError(err.message || 'Failed to export PDF');
    }
    setExportingPdf(false);
  };

  const handleExportCSV = async () => {
    setExporting(true);
    setError(null);
    try {
      const filters: ShortExpiryReportFilters = { startDate, endDate };
      if (selectedOutlet !== 'all') {
        filters.outlet = selectedOutlet;
      }
      if (selectedSalesRep !== 'all') {
        filters.salesRep = selectedSalesRep;
      }
      if (searchQuery.trim()) {
        filters.search = searchQuery.trim();
      }
      await shortExpiryReportService.exportToCSV(filters);
    } catch (err: any) {
      setError(err.message || 'Failed to export CSV');
    }
    setExporting(false);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };


  const getDaysToExpiryColor = (status: 'expired' | 'critical' | 'warning' | 'good') => {
    switch (status) {
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'good':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate('/visits')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors text-xs"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back to Reports</span>
          </button>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-orange-100 rounded-lg">
                <Calendar className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Short Expiry Report</h1>
                <p className="text-xs text-gray-600 mt-1">
                  View products with short expiry dates
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                <Download className="w-3 h-3" />
                {exporting ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                onClick={handleExportPDF}
                disabled={exportingPdf}
                className="px-3 py-1.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs"
              >
                <Download className="w-3 h-3" />
                {exportingPdf ? 'Generating PDF...' : 'Export PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 max-w-xs">
          <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <p className="text-[10px] text-gray-500">
              {daysFilterActive ? 'Total value (filtered rows on this page)' : 'Total value of short expiry stock'}
            </p>
            <p className="text-lg font-bold text-red-600">KES {formatMoney(cardTotal)}</p>
            <p className="text-[10px] text-gray-400">Quantity x selling price</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search product name, batch number, outlet, sales rep..."
              className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-xs"
            />
          </div>
        </div>

        {/* Filters */}
        <FilterPanel
          startDate={startDate}
          endDate={endDate}
          selectedOutlet={selectedOutlet}
          selectedSalesRep={selectedSalesRep}
          minDaysLeft={minDaysLeft}
          maxDaysLeft={maxDaysLeft}
          outlets={outlets}
          salesReps={salesReps}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          onOutletChange={handleOutletChange}
          onSalesRepChange={handleSalesRepChange}
          onMinDaysLeftChange={setMinDaysLeft}
          onMaxDaysLeftChange={setMaxDaysLeft}
          onResetFilters={handleResetFilters}
        />

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Reports Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <p className="mt-2 text-xs text-gray-600">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="p-8 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-600">No short expiry reports found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Region
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Outlet
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Outlet Type
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Outlet Account
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Sales Rep
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Product Name
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Unit Price
                      </th>
                      <th className="px-3 py-2 text-right text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Subtotal
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Batch Number
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Product SKU
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Expiry Date
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Days to Expiry
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Created At
                      </th>
                      <th className="px-3 py-2 text-left text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                        Comment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReports.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[10px] text-gray-900">
                            {report.regionName || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <Building2 className="h-3 w-3 text-gray-400 mr-1.5" />
                            <span className="text-[10px] text-gray-900">
                              {report.outletName || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[10px] text-gray-900">
                            {report.outletTypeName || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[10px] text-gray-900">
                            {report.outletAccountName || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <User className="h-3 w-3 text-gray-400 mr-1.5" />
                            <span className="text-[10px] text-gray-900">
                              {report.salesRepName || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <Package className="h-3 w-3 text-gray-400 mr-1.5" />
                            <span className="text-[10px] font-medium text-gray-900">
                              {report.product_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[10px] text-gray-900">{report.quantity}</span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-[10px] text-gray-900">
                            {report.unitPrice != null && report.unitPrice !== ''
                              ? Number(report.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <span className="text-[10px] font-medium text-gray-900">
                            {report.unitPrice != null && report.unitPrice !== '' ? formatMoney(rowSubtotal(report)) : 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <Hash className="h-3 w-3 text-gray-400 mr-1.5" />
                            <span className="text-[10px] text-gray-900">{report.batch_number}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[10px] text-gray-900">
                            {report.productSku || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center">
                            <CalendarIcon className="h-3 w-3 text-gray-400 mr-1.5" />
                            <span className="text-[10px] text-gray-900">{report.expiry_date}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {(() => {
                            const { days, status } = calculateDaysToExpiry(report.expiry_date);
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium border ${getDaysToExpiryColor(status)}`}>
                                {status === 'expired' ? `Expired ${days} day${days !== 1 ? 's' : ''} ago` : `${days} day${days !== 1 ? 's' : ''} left`}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-[10px] text-gray-500">
                            {formatDate(report.createdAt)}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="text-[10px] text-gray-700 break-words max-w-xs inline-block">
                            {report.comment || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredReports.length === 0 && reports.length > 0 && (
                      <tr>
                        <td colSpan={15} className="px-3 py-6 text-center text-[10px] text-gray-500">
                          No reports match the selected days-to-expiry filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
                  <div className="flex items-center space-x-3">
                    <span className="text-[10px] text-gray-700">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                    </span>
                    <select
                      value={pagination.limit}
                      onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                      className="border border-gray-300 rounded-md px-2 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <option value={5}>5 per page</option>
                      <option value={10}>10 per page</option>
                      <option value={20}>20 per page</option>
                      <option value={50}>50 per page</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                      className="px-2 py-1 text-[10px] border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-2 py-1 text-[10px] border rounded-md ${
                            pagination.page === pageNum
                              ? 'bg-red-600 text-white border-red-600'
                              : 'border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages}
                      className="px-2 py-1 text-[10px] border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default ShortExpiryReportPage;
