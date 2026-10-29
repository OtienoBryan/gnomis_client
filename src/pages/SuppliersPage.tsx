import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_CONFIG } from '../config/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// CSV Export utility function
const exportToCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  
  // Define CSV headers
  const headers = [
    'Company Name',
    'Supplier Code',
    'Contact Person',
    'Email',
    'Phone',
    'Tax ID',
    'Address',
    'Payment Terms (days)',
    'Credit Limit',
    'Balance'
  ];
  
  // Convert data to CSV format
  const csvContent = [
    headers.join(','),
    ...data.map(supplier => [
      `"${supplier.company_name || ''}"`,
      `"${supplier.supplier_code || ''}"`,
      `"${supplier.contact_person || ''}"`,
      `"${supplier.email || ''}"`,
      `"${supplier.phone || ''}"`,
      `"${supplier.tax_id || ''}"`,
      `"${supplier.address || ''}"`,
      supplier.payment_terms || '',
      supplier.credit_limit || '',
      supplier.balance || ''
    ].join(','))
  ].join('\n');
  
  // Create and download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// PDF Export utility function
const loadLogo = (): Promise<{ dataUrl: string; w: number; h: number } | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/logo.jpg';
  });

const exportToPDF = async (data: any[], filename: string) => {
  if (data.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const money = (v: any) =>
    (Number(v) || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Company header
  const logo = await loadLogo();
  let textX = 14;
  if (logo) {
    const logoH = 24;
    const logoW = Math.min(40, (logo.w / logo.h) * logoH);
    doc.addImage(logo.dataUrl, 'JPEG', 14, 8, logoW, logoH);
    textX = 14 + logoW + 6;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('GNOMIS QUALITY PRODUCTS LIMITED', textX, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('EMAIL: gnomisp@gmail.com; gnomisp@yahoo.com', textX, 22);
  doc.text('Contacts: +254725606061/0724803741', textX, 28);
  doc.setDrawColor(200);
  doc.line(14, 35, pageWidth - 14, 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Suppliers List', 14, 43);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - 14, 43, { align: 'right' });

  const totalBalance = data.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);

  autoTable(doc, {
    startY: 47,
    head: [['#', 'Company', 'Code', 'Contact', 'Email', 'Phone', 'Tax ID', 'Balance (KES)']],
    body: data.map((s, i) => [
      i + 1,
      s.company_name || '',
      s.supplier_code || '-',
      s.contact_person || '-',
      s.email || '-',
      s.phone || '-',
      s.tax_id || '-',
      money(s.balance)
    ]),
    foot: [['', 'Total', '', '', '', '', '', money(totalBalance)]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [220, 38, 38] },
    footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10 }, 7: { halign: 'right' } },
    didDrawPage: () => {
      doc.setFontSize(8);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - 14, doc.internal.pageSize.getHeight() - 8, { align: 'right' });
    }
  });

  doc.save(`${filename}.pdf`);
};

// Icons for the UI
const Icons = {
  Search: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
    </svg>
  ),
  Building: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  Users: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
    </svg>
  ),
  Currency: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
    </svg>
  ),
  Edit: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  Ledger: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Close: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),

};

// Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange';
  onClick?: () => void;
  isActive?: boolean;
  filterText?: string;
}> = ({ title, value, icon, color, onClick, isActive, filterText }) => {
  const colorClasses = {
    blue: { border: 'border-red-500', iconBg: 'bg-red-50', iconText: 'text-red-600', valueText: 'text-red-700' },
    green: { border: 'border-green-500', iconBg: 'bg-green-50', iconText: 'text-green-600', valueText: 'text-green-700' },
    purple: { border: 'border-purple-500', iconBg: 'bg-purple-50', iconText: 'text-purple-600', valueText: 'text-purple-700' },
    orange: { border: 'border-orange-500', iconBg: 'bg-orange-50', iconText: 'text-orange-600', valueText: 'text-orange-700' }
  };
  const c = colorClasses[color];

  const activeClasses = isActive ? 'ring-2 ring-red-200' : '';

  return (
    <div
      className={`bg-white border ${c.border} rounded-xl shadow-sm p-4 transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${activeClasses}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500">{title}</p>
          <p className={`text-xl font-bold ${c.valueText}`}>{value}</p>
          {filterText && (
            <p className="text-xs text-gray-400 mt-1">{filterText}</p>
          )}
        </div>
        <div className={`${c.iconBg} ${c.iconText} rounded-lg p-2`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// Enhanced Modal Component
const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}> = ({ open, onClose, title, children, size = 'md' }) => {
  if (!open) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} mx-4 max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <Icons.Close />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// Enhanced Supplier Edit Modal
const SupplierEditModal: React.FC<{
  open: boolean;
  supplier: any;
  onClose: () => void;
  onSave: () => void;
}> = ({ open, supplier, onClose, onSave }) => {
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && supplier) {
      setForm({ ...supplier });
      setError(null);
    }
  }, [open, supplier]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f: any) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_CONFIG.getUrl(`/financial/suppliers/${supplier.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          supplier_code: form.supplier_code,
          company_name: form.company_name,
          contact_person: form.contact_person,
          email: form.email,
          phone: form.phone,
          address: form.address,
          tax_id: form.tax_id,
          payment_terms: form.payment_terms,
          credit_limit: form.credit_limit
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setLoading(false);
      onSave();
      onClose();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to update supplier');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Supplier" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
            <input
              name="company_name"
              value={form.company_name || ''}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Code</label>
            <input
              name="supplier_code"
              value={form.supplier_code || ''}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Contact Person</label>
            <input
              name="contact_person"
              value={form.contact_person || ''}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              name="email"
              value={form.email || ''}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
              type="email"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
            <input
              name="phone"
              value={form.phone || ''}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID</label>
            <input
              name="tax_id"
              value={form.tax_id || ''}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Terms (days)</label>
            <input
              name="payment_terms"
              value={form.payment_terms || ''}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
              type="number"
              min={0}
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Credit Limit</label>
            <input
              name="credit_limit"
              value={form.credit_limit || ''}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
              type="number"
              min={0}
              disabled={loading}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
          <textarea
            name="address"
            value={form.address || ''}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors duration-200"
            rows={3}
            disabled={loading}
          />
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="text-red-800 text-sm">{error}</div>
          </div>
        )}
        
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Supplier Add Modal
const INITIAL_SUPPLIER_FORM = {
  company_name: '',
  phone: '',
  email: '',
  address: '',
  tax_id: '',
  payment_terms: '30',
  credit_limit: ''
};

const SupplierAddModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSave: () => void;
}> = ({ open, onClose, onSave }) => {
  const [form, setForm] = useState<any>(INITIAL_SUPPLIER_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f: any) => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_CONFIG.getUrl('/financial/suppliers'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          company_name: form.company_name,
          phone: form.phone,
          email: form.email,
          address: form.address,
          tax_id: form.tax_id,
          payment_terms: form.payment_terms === '' ? 30 : Number(form.payment_terms),
          credit_limit: form.credit_limit === '' ? 0 : Number(form.credit_limit)
        })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      setLoading(false);
      onSave();
      onClose();
      setForm(INITIAL_SUPPLIER_FORM);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to add supplier');
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors';
  const labelClass = 'block text-xs font-medium text-gray-700 mb-1.5';

  return (
    <Modal open={open} onClose={handleClose} title="Add Supplier" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Name <span className="text-red-500">*</span></label>
          <input name="company_name" value={form.company_name} onChange={handleChange} className={inputClass}
            required disabled={loading} autoFocus placeholder="e.g. Timberline Supplies Ltd" />
        </div>
        <div>
          <label className={labelClass}>Mobile Number</label>
          <input name="phone" value={form.phone} onChange={handleChange} className={inputClass}
            disabled={loading} placeholder="e.g. 0712 345 678" />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input name="email" type="email" value={form.email} onChange={handleChange} className={inputClass}
            disabled={loading} placeholder="supplier@example.com" />
        </div>
        <div>
          <label className={labelClass}>Location</label>
          <input name="address" value={form.address} onChange={handleChange} className={inputClass}
            disabled={loading} placeholder="e.g. Industrial Area, Nairobi" />
        </div>
        <div>
          <label className={labelClass}>Tax PIN</label>
          <input name="tax_id" value={form.tax_id} onChange={handleChange} className={inputClass}
            disabled={loading} placeholder="e.g. P051234567X" />
        </div>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Payment Terms &amp; Credit</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Payment Terms (days)</label>
              <input name="payment_terms" type="number" min={0} value={form.payment_terms} onChange={handleChange}
                className={inputClass} disabled={loading} />
            </div>
            <div>
              <label className={labelClass}>Credit Limit</label>
              <input name="credit_limit" type="number" min={0} value={form.credit_limit} onChange={handleChange}
                className={inputClass} disabled={loading} placeholder="e.g. 500000" />
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-xs">{error}</div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={handleClose} disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
            {loading ? 'Adding...' : 'Add Supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
};



const SuppliersPage: React.FC = () => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editSupplier, setEditSupplier] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [balanceFilter, setBalanceFilter] = useState<'all' | 'with_balance' | 'zero_balance'>('all');
  const [balanceSort, setBalanceSort] = useState<'asc' | 'desc' | null>(null);
  const navigate = useNavigate();

  const fetchSuppliers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_CONFIG.getUrl('/financial/suppliers'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setSuppliers(data.data || []);
      } else {
        setError('Failed to fetch suppliers');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = q
      ? suppliers.filter((s: any) =>
          [s.company_name, s.contact_person, s.email, s.phone, s.supplier_code]
            .filter(Boolean)
            .some((v: string) => v.toLowerCase().includes(q))
        )
      : suppliers;
    
    // Apply balance filter
    if (balanceFilter === 'with_balance') {
      base = base.filter((s: any) => (Number(s.balance) || 0) > 0);
    } else if (balanceFilter === 'zero_balance') {
      base = base.filter((s: any) => (Number(s.balance) || 0) === 0);
    }
    
    // Apply balance sorting
    if (balanceSort === 'asc') {
      base = [...base].sort((a: any, b: any) => {
        const balanceA = Number(a.balance) || 0;
        const balanceB = Number(b.balance) || 0;
        return balanceA - balanceB;
      });
    } else if (balanceSort === 'desc') {
      base = [...base].sort((a: any, b: any) => {
        const balanceA = Number(a.balance) || 0;
        const balanceB = Number(b.balance) || 0;
        return balanceB - balanceA;
      });
    }
    
    return base;
  }, [suppliers, search, balanceFilter, balanceSort]);

  const paginatedSuppliers = useMemo(() => {
    if (pageSize === filtered.length) {
      return filtered; // View All - return all suppliers
    }
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, currentPage, pageSize]);

  const totalPages = pageSize === filtered.length ? 1 : Math.ceil(filtered.length / pageSize);

  const totalBalance = useMemo(() => {
    return suppliers.reduce((sum, s: any) => sum + (Number(s.balance) || 0), 0);
  }, [suppliers]);

  const handleEdit = (supplier: any) => {
    setEditSupplier(supplier);
    setEditOpen(true);
  };

  const handleViewLedger = (supplier: any) => {
    navigate(`/suppliers/${supplier.id}/ledger`);
  };

  const handleViewInvoices = (supplier: any) => {
    navigate(`/suppliers/${supplier.id}/invoices`);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleBalanceFilterChange = () => {
    if (balanceFilter === 'all') {
      setBalanceFilter('with_balance');
    } else if (balanceFilter === 'with_balance') {
      setBalanceFilter('zero_balance');
    } else {
      setBalanceFilter('all');
    }
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleBalanceSort = () => {
    if (balanceSort === null) {
      setBalanceSort('asc');
    } else if (balanceSort === 'asc') {
      setBalanceSort('desc');
    } else {
      setBalanceSort(null);
    }
    setCurrentPage(1); // Reset to first page when sorting
  };

  const handleTotalSuppliersClick = () => {
    setSearch(''); // Clear search
    setBalanceFilter('all'); // Clear balance filter
    setCurrentPage(1); // Reset to first page
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading suppliers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full py-8 px-2 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Suppliers</h1>
              <p className="text-xs text-gray-600 mt-1">Manage supplier profiles and monitor financial relationships</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportToCSV(filtered, `suppliers_${new Date().toISOString().split('T')[0]}`)}
                disabled={filtered.length === 0}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV
              </button>
              <button
                onClick={() => exportToPDF(filtered, `suppliers_${new Date().toISOString().split('T')[0]}`)}
                disabled={filtered.length === 0}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Convert to PDF
              </button>
              <button
                className="px-3 py-1.5 text-xs bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center gap-1.5 shadow-lg"
                onClick={() => setAddOpen(true)}
              >
                <Icons.Plus />
                Add Supplier
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <Icons.Search />
            </div>
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="block w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            title="Total Suppliers"
            value={suppliers.length}
            icon={<Icons.Building />}
            color="blue"
            onClick={handleTotalSuppliersClick}
            isActive={search === '' && balanceFilter === 'all'}
            filterText={
              search === '' && balanceFilter === 'all' ? 'All suppliers shown' : 'Click to show all'
            }
          />
          <StatCard
            title="Filtered Suppliers"
            value={filtered.length}
            icon={<Icons.Users />}
            color="green"
          />
          <StatCard
            title="Total Balance"
            value={totalBalance.toLocaleString(undefined, { style: 'currency', currency: 'KES' })}
            icon={<Icons.Currency />}
            color="purple"
            onClick={handleBalanceFilterChange}
            isActive={balanceFilter !== 'all'}
            filterText={
              balanceFilter === 'with_balance' ? 'Filtered: With Balance' :
              balanceFilter === 'zero_balance' ? 'Filtered: Zero Balance' :
              'Click to filter'
            }
          />
        </div>

        {/* Content */}
        {error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <div className="text-red-800 text-lg font-medium mb-2">Error Loading Suppliers</div>
            <div className="text-red-600">{error}</div>
            <button
              onClick={fetchSuppliers}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 text-gray-400 mx-auto mb-4">
              <Icons.Building />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No suppliers found</h3>
            <p className="text-gray-500 mb-6">
              {search ? 'Try adjusting your search terms' : 'Get started by adding your first supplier'}
            </p>
            {!search && (
              <button
                onClick={() => setAddOpen(true)}
                className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                Add Supplier
              </button>
            )}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full divide-y divide-gray-200 min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tax ID</th>
                    <th 
                      className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors duration-200 select-none"
                      onClick={handleBalanceSort}
                    >
                      <div className="flex items-center justify-end gap-1">
                        Balance
                        {balanceSort === 'asc' && (
                          <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        )}
                        {balanceSort === 'desc' && (
                          <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                        {balanceSort === null && (
                          <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                          </svg>
                        )}
                      </div>
                    </th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedSuppliers.map((supplier: any) => (
                    <tr key={supplier.id} className="hover:bg-gray-50 transition-colors duration-200">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{supplier.company_name}</div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {supplier.supplier_code || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {supplier.contact_person || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {supplier.email || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {supplier.phone || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {supplier.tax_id || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right">
                        <div className="text-sm font-semibold text-red-600">
                          {supplier.balance != null && !isNaN(Number(supplier.balance))
                            ? Number(supplier.balance).toLocaleString(undefined, { style: 'currency', currency: 'KES' })
                            : 'KES\u00A00.00'}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleViewInvoices(supplier)}
                            className="px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded hover:bg-red-100 transition-colors duration-200"
                          >
                            Invoices
                          </button>
                          <button
                            onClick={() => handleViewLedger(supplier)}
                            className="px-2 py-1 bg-purple-50 text-purple-700 text-xs font-medium rounded hover:bg-purple-100 transition-colors duration-200"
                          >
                            Ledger
                          </button>
                          <button
                            onClick={() => handleEdit(supplier)}
                            className="px-2 py-1 bg-yellow-50 text-yellow-700 text-xs font-medium rounded hover:bg-yellow-100 transition-colors duration-200"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-6 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-700">
                  {pageSize === filtered.length 
                    ? `Showing all ${filtered.length} suppliers`
                    : `Showing ${((currentPage - 1) * pageSize) + 1} to ${Math.min(currentPage * pageSize, filtered.length)} of ${filtered.length} suppliers`
                  }
                </div>
                <button
                  onClick={() => exportToCSV(filtered, `suppliers_${new Date().toISOString().split('T')[0]}`)}
                  disabled={filtered.length === 0}
                  className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export
                </button>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-700">Show:</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'all') {
                        setPageSize(filtered.length);
                      } else {
                        setPageSize(Number(value));
                      }
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded px-2 py-1 text-sm"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value="all">View All</option>
                  </select>
                  <span className="text-sm text-gray-700">per page</span>
                </div>
              </div>
              
              {pageSize !== filtered.length && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 border rounded-lg text-sm transition-colors duration-200 ${
                            currentPage === pageNum
                              ? 'bg-red-600 text-white border-red-600'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modals */}
        <SupplierEditModal
          open={editOpen}
          supplier={editSupplier}
          onClose={() => setEditOpen(false)}
          onSave={() => {
            setEditOpen(false);
            setEditSupplier(null);
            fetchSuppliers();
          }}
        />
        <SupplierAddModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSave={() => {
            setAddOpen(false);
            fetchSuppliers();
          }}
        />
      </div>
    </div>
  );
};

export default SuppliersPage; 