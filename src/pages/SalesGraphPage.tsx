import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Download } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface MonthlySales {
  month_key: string;
  month_label: string;
  total_orders: number;
  total_subtotal: number;
  total_tax: number;
  total_amount: number;
}

const SalesGraphPage: React.FC = () => {
  const navigate = useNavigate();
  const [months, setMonths] = useState<MonthlySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMonthlySales();
  }, []);

  const fetchMonthlySales = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/financial/sales-report/monthly', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch monthly sales report`);
      }

      const data = await response.json();
      if (data.success) {
        // API returns newest-first; chart should read chronologically left to right
        setMonths([...(data.data || [])].reverse());
      } else {
        throw new Error(data.error || 'Failed to fetch monthly sales report');
      }
    } catch (err: any) {
      console.error('Error fetching monthly sales report:', err);
      setError(err.message || 'Failed to fetch monthly sales report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(amount));

  const handleExportPDF = async () => {
    if (!chartRef.current) return;

    try {
      setExportingPdf(true);
      const element = chartRef.current;

      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });

      const pageWidth = 297; // A4 landscape width in mm
      const pageHeight = 210; // A4 landscape height in mm
      const margin = 10;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.setFontSize(14);
      pdf.text('Sales Graph', margin, margin);
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, margin + 5);

      const imageTop = margin + 10;
      const maxImgHeight = pageHeight - imageTop - margin;
      const finalHeight = Math.min(imgHeight, maxImgHeight);
      const finalWidth = (canvas.width * finalHeight) / canvas.height;

      pdf.addImage(imgData, 'PNG', margin, imageTop, finalWidth, finalHeight, undefined, 'FAST');

      const filename = `sales-graph-${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-3 text-xs text-gray-600">Loading sales graph...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xs font-semibold text-red-600">Error</p>
          <p className="text-xs text-red-600 mt-1">{error}</p>
          <button
            onClick={fetchMonthlySales}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-8xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="mb-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-red-600 hover:text-red-700 mb-2.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Back</span>
          </button>

          <div className="bg-white border border-gray-200 rounded-md p-3">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-orange-50 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900">Sales Graph</h1>
                  <p className="text-[10px] text-gray-500">Confirmed sales totals by month</p>
                </div>
              </div>
              <button
                onClick={handleExportPDF}
                disabled={exportingPdf || months.length === 0}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exportingPdf ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-3 w-3" />
                    Export PDF
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div ref={chartRef} className="bg-white border border-gray-200 rounded-md p-3 sm:p-4">
          {months.length > 0 ? (
            <ResponsiveContainer width="100%" height={360}>
              <BarChart data={months} margin={{ top: 12, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="month_label"
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  angle={-35}
                  textAnchor="end"
                  height={55}
                />
                <YAxis
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => formatCurrency(Number(v))}
                  width={80}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const row = payload[0].payload as MonthlySales;
                      return (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1">{row.month_label}</p>
                          <p className="text-sm font-bold text-gray-900">{formatCurrency(row.total_amount)}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{row.total_orders} order{row.total_orders === 1 ? '' : 's'}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="total_amount" fill="#ea580c" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-xs">No sales data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SalesGraphPage;
