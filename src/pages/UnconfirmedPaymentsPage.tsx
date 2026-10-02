import React, { useState, useEffect } from 'react';
import { FileText, Download, Filter, AlertCircle } from 'lucide-react';

interface Receipt {
  id: number;
  receipt_number: string;
  receipt_date: string;
  client_id: number;
  client_name: string;
  account_id?: number;
  account_name?: string;
  payment_method: string;
  amount: number;
  reference: string;
  notes: string;
  status: string;
  created_at: string;
}

const UnconfirmedPaymentsPage: React.FC = () => {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    paymentMethod: '',
    clientName: '',
    accountName: ''
  });
  const [filteredReceipts, setFilteredReceipts] = useState<Receipt[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [confirmReference, setConfirmReference] = useState('');
  const [confirmDate, setConfirmDate] = useState('');

  useEffect(() => {
    fetchReceipts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [receipts, filters]);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/financial/receipts?status=in pay', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      
      if (data.success) {
        setReceipts(data.data || []);
      } else {
        setError(data.error || 'Failed to fetch unconfirmed payments');
      }
    } catch (err: any) {
      console.error('Error fetching unconfirmed payments:', err);
      setError('Failed to fetch unconfirmed payments');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...receipts];

    // Filter by date range
    if (filters.startDate) {
      filtered = filtered.filter(receipt => 
        new Date(receipt.receipt_date) >= new Date(filters.startDate)
      );
    }

    if (filters.endDate) {
      filtered = filtered.filter(receipt => 
        new Date(receipt.receipt_date) <= new Date(filters.endDate)
      );
    }

    // Filter by payment method
    if (filters.paymentMethod) {
      filtered = filtered.filter(receipt => 
        receipt.payment_method.toLowerCase().includes(filters.paymentMethod.toLowerCase())
      );
    }

    // Filter by client name
    if (filters.clientName) {
      filtered = filtered.filter(receipt => 
        receipt.client_name.toLowerCase().includes(filters.clientName.toLowerCase())
      );
    }

    // Filter by account name
    if (filters.accountName) {
      filtered = filtered.filter(receipt => 
        receipt.account_name && receipt.account_name.toLowerCase().includes(filters.accountName.toLowerCase())
      );
    }

    setFilteredReceipts(filtered);
  };

  const calculateTotals = () => {
    const totalAmount = filteredReceipts.reduce((sum, receipt) => sum + Number(receipt.amount), 0);
    const totalReceipts = filteredReceipts.length;
    
    // Group by payment method
    const byPaymentMethod = filteredReceipts.reduce((acc, receipt) => {
      const method = receipt.payment_method || 'Unknown';
      acc[method] = (acc[method] || 0) + Number(receipt.amount);
      return acc;
    }, {} as Record<string, number>);

    // Group by account
    const byAccount = filteredReceipts.reduce((acc, receipt) => {
      const account = receipt.account_name || `Account ${receipt.account_id || 'Unknown'}`;
      acc[account] = (acc[account] || 0) + Number(receipt.amount);
      return acc;
    }, {} as Record<string, number>);

    return { totalAmount, totalReceipts, byPaymentMethod, byAccount };
  };

    const handleConfirmPayment = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setConfirmReference(receipt.reference || '');
    setConfirmDate(new Date().toISOString().split('T')[0]); // Set today's date as default
    setShowConfirmModal(true);
  };

  const handleConfirmPaymentSubmit = async () => {
    if (!selectedReceipt) return;

    try {
      const response = await fetch(`/api/financial/receipts/${selectedReceipt.id}/confirm`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          status: 'confirmed',
          reference: confirmReference,
          receipt_date: confirmDate
        })
      });

      if (response.ok) {
        // Remove the confirmed receipt from the list
        setReceipts(prevReceipts => prevReceipts.filter(receipt => receipt.id !== selectedReceipt.id));
        // Show success message
        alert('Payment confirmed successfully!');
        // Close modal and reset form
        setShowConfirmModal(false);
        setSelectedReceipt(null);
        setConfirmReference('');
        setConfirmDate('');
        // Refresh the data
        fetchReceipts();
      } else {
        console.error('Failed to confirm payment');
        alert('Failed to confirm payment. Please try again.');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Error confirming payment. Please try again.');
    }
  };

  const handleDeclinePayment = async (receiptId: number) => {
    try {
      const response = await fetch(`/api/financial/receipts/${receiptId}/decline`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ status: 'cancelled' })
      });

      if (response.ok) {
        // Remove the declined receipt from the list
        setReceipts(prevReceipts => prevReceipts.filter(receipt => receipt.id !== receiptId));
        // Show success message
        alert('Payment declined successfully!');
        // Refresh the data
      fetchReceipts();
      } else {
        console.error('Failed to decline payment');
        alert('Failed to decline payment. Please try again.');
      }
    } catch (error) {
      console.error('Error declining payment:', error);
      alert('Error declining payment. Please try again.');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Receipt #',
      'Date',
      'Client Name',
      'Account',
      'Payment Method',
      'Amount',
      'Reference',
      'Notes'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredReceipts.map(receipt => [
        receipt.receipt_number,
        new Date(receipt.receipt_date).toLocaleDateString(),
        receipt.client_name,
        receipt.account_name || `Account ${receipt.account_id || 'Unknown'}`,
        receipt.payment_method,
        receipt.amount,
        receipt.reference || '',
        receipt.notes || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unconfirmed-payments-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatKES = (amount: number) => {
    return Number(amount).toLocaleString(undefined, { 
      style: 'currency', 
      currency: 'KES' 
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-3 text-xs text-gray-600">Loading unconfirmed payments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xs text-red-600">{error}</p>
          <button
            onClick={fetchReceipts}
            className="mt-3 px-3 py-1.5 text-xs bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <div className="w-full px-4 py-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-orange-50 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Unconfirmed Payments</h1>
              <p className="text-[10px] text-gray-500">Payments pending confirmation</p>
            </div>
          </div>
          <button
            onClick={exportToCSV}
            className="px-2.5 py-1.5 bg-orange-600 text-white text-xs font-medium rounded-md hover:bg-orange-700 flex items-center gap-1.5"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3">
        <div className="bg-white border border-gray-200 rounded-md p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium text-gray-500">Pending Amount</p>
              <p className="text-xs font-bold text-orange-600">{formatKES(totals.totalAmount)}</p>
            </div>
            <div className="h-7 w-7 rounded-md bg-orange-50 flex items-center justify-center">
              <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium text-gray-500">Pending Receipts</p>
              <p className="text-xs font-bold text-red-600">{totals.totalReceipts}</p>
            </div>
            <div className="h-7 w-7 rounded-md bg-red-50 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium text-gray-500">Payment Methods</p>
              <p className="text-xs font-bold text-purple-600">{Object.keys(totals.byPaymentMethod).length}</p>
            </div>
            <div className="h-7 w-7 rounded-md bg-purple-50 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-2.5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-medium text-gray-500">Accounts</p>
              <p className="text-xs font-bold text-red-600">{Object.keys(totals.byAccount).length}</p>
            </div>
            <div className="h-7 w-7 rounded-md bg-red-50 flex items-center justify-center">
              <FileText className="h-3.5 w-3.5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Filter className="w-3.5 h-3.5 text-gray-600" />
          <h3 className="text-xs font-semibold text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Payment Method</label>
            <input
              type="text"
              placeholder="e.g., Cash, Bank"
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Client Name</label>
            <input
              type="text"
              placeholder="Search client name"
              value={filters.clientName}
              onChange={(e) => setFilters({ ...filters, clientName: e.target.value })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-700 mb-1">Account Name</label>
            <select
              value={filters.accountName}
              onChange={(e) => setFilters({ ...filters, accountName: e.target.value })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">All Accounts</option>
              {Array.from(new Set(receipts
                .map(receipt => receipt.account_name || `Account ${receipt.account_id || 'Unknown'}`)
                .filter(Boolean)
              )).sort().map(accountName => (
                <option key={accountName} value={accountName}>
                  {accountName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 hidden">
        <h3 className="text-xs font-semibold text-gray-900 mb-2.5">Pending Amounts by Payment Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {Object.entries(totals.byPaymentMethod).map(([method, amount]) => (
            <div key={method} className="bg-gray-50 rounded-md p-2.5">
              <p className="text-[10px] text-gray-600">{method}</p>
              <p className="text-xs font-bold text-orange-600">{formatKES(amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Accounts Breakdown */}
      <div className="bg-white border border-gray-200 rounded-md p-3 mb-3 hidden">
        <h3 className="text-xs font-semibold text-gray-900 mb-2.5">Pending Amounts by Account</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {Object.entries(totals.byAccount).map(([account, amount]) => (
            <div key={account} className="bg-gray-50 rounded-md p-2">
              <p className="text-[10px] text-gray-600 truncate">{account}</p>
              <p className="text-xs font-bold text-red-600">{formatKES(amount)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-900">
            Unconfirmed Receipts ({filteredReceipts.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Receipt #
                </th>
                <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Client Name
                </th>
                <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-3 py-2 text-right text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-3 py-2 text-center text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-3 text-center text-xs text-gray-500">
                    No unconfirmed receipts found
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                      {receipt.receipt_number}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                      {formatDate(receipt.receipt_date)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      {receipt.client_name || `Client ${receipt.client_id || 'Unknown'}`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                      {receipt.account_name || `Account ${receipt.account_id || 'Unknown'}`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                      <span className="px-1.5 py-0.5 text-[9px] font-medium bg-orange-100 text-orange-800 rounded-full">
                        {receipt.payment_method}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-bold text-orange-600">
                      {formatKES(receipt.amount)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-700">
                      {receipt.reference || '-'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 max-w-[160px] truncate">
                      {receipt.notes || '-'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center text-xs font-medium">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleConfirmPayment(receipt)}
                          className="px-2 py-1 bg-green-600 text-white text-[10px] font-medium rounded-md hover:bg-green-700 transition-colors"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleDeclinePayment(receipt.id)}
                          className="px-2 py-1 bg-red-600 text-white text-[10px] font-medium rounded-md hover:bg-red-700 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && selectedReceipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-md p-4 w-full max-w-sm mx-4">
            <h3 className="text-xs font-semibold text-gray-900 mb-3">
              Confirm Payment
            </h3>
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">
                  Receipt Number
                </label>
                <input
                  type="text"
                  value={selectedReceipt.receipt_number}
                  disabled
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">
                  Client Name
                </label>
                <input
                  type="text"
                  value={selectedReceipt.client_name || `Client ${selectedReceipt.client_id}`}
                  disabled
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="text"
                  value={formatKES(selectedReceipt.amount)}
                  disabled
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">
                  Reference *
                </label>
                <input
                  type="text"
                  value={confirmReference}
                  onChange={(e) => setConfirmReference(e.target.value)}
                  placeholder="Enter payment reference"
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">
                  Receipt Date *
                </label>
                <input
                  type="date"
                  value={confirmDate}
                  onChange={(e) => setConfirmDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-green-500"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setSelectedReceipt(null);
                  setConfirmReference('');
                  setConfirmDate('');
                }}
                className="px-3 py-1.5 text-xs text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPaymentSubmit}
                disabled={!confirmReference || !confirmDate}
                className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnconfirmedPaymentsPage; 