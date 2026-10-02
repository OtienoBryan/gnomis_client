import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';

interface PaymentActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PendingPayment | null;
  action: 'confirm' | 'decline';
  onSubmit: (paymentId: number, action: 'confirm' | 'decline', reference: string, notes: string) => void;
  processing: boolean;
}

interface PendingPayment {
  id: number;
  payment_number: string;
  payment_date: string;
  payment_method: string;
  amount: number;
  reference: string;
  notes: string;
  status: string;
  currency: string;
  created_at: string;
  supplier_name: string;
  supplier_id: number;
  payment_account_name: string;
  payment_account_code: string;
  journal_entry_number: string;
  expense_reference: string;
  expense_description: string;
  expense_amount: number;
  created_by_name: string;
}



const PendingPaymentsPage: React.FC = () => {
  const [payments, setPayments] = useState<PendingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PendingPayment | null>(null);
  const [actionType, setActionType] = useState<'confirm' | 'decline'>('confirm');
  const [processingAction, setProcessingAction] = useState(false);

  useEffect(() => {
    fetchPendingPayments();
  }, []);

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/financial/expense-payments/pending');
      setPayments(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching pending payments:', err);
      setError('Failed to fetch pending payments');
    } finally {
      setLoading(false);
    }
  };



  const openActionModal = (payment: PendingPayment, action: 'confirm' | 'decline') => {
    setSelectedPayment(payment);
    setActionType(action);
    setShowActionModal(true);
  };

  const closeActionModal = () => {
    setShowActionModal(false);
    setSelectedPayment(null);
    setActionType('confirm');
  };

  const handlePaymentAction = async (paymentId: number, action: 'confirm' | 'decline', reference: string, notes: string) => {
    const confirmed = window.confirm(
      action === 'confirm'
        ? 'Confirm this payment? This will mark it as paid and cannot be undone from here.'
        : 'Decline this payment? This will cancel it.'
    );
    if (!confirmed) return;

    try {
      setProcessingAction(true);

      const response = await axios.put(`/api/financial/expense-payments/${paymentId}/status`, {
        status: action === 'confirm' ? 'confirmed' : 'cancelled',
        reference,
        notes
      });

      if (response.data.success) {
        // Refresh the payments list
        await fetchPendingPayments();
        closeActionModal();
        // Show success message
        alert(`Payment ${action === 'confirm' ? 'confirmed' : 'declined'} successfully`);
      }
    } catch (err) {
      console.error(`Error ${action}ing payment:`, err);
      alert(`Failed to ${action} payment. Please try again.`);
    } finally {
      setProcessingAction(false);
    }
  };

  const formatCurrency = (amount: number, currency: string = 'KES') => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const getPaymentMethodBadge = (method: string) => {
    const colors = {
      cash: 'bg-green-100 text-green-800',
      check: 'bg-red-100 text-red-800', 
      bank_transfer: 'bg-purple-100 text-purple-800',
      credit_card: 'bg-red-100 text-red-800',
      mobile_money: 'bg-yellow-100 text-yellow-800'
    };
    
    const color = colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${color}`}>
        {method.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full mx-auto px-4 py-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded-md p-3 mb-3">
          <h1 className="text-sm font-bold text-gray-900">Pending Expense Payments</h1>
          <p className="text-[10px] text-gray-500 mt-0.5">Review and manage pending expense payments</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-2.5 mb-3">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-red-400 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Payments Table */}
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200">
            <h3 className="text-xs font-semibold text-gray-900">Pending Payments ({payments.length})</h3>
          </div>

          {payments.length === 0 ? (
            <div className="text-center py-10">
              <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-xs font-medium text-gray-900">No pending payments found</h3>
              <p className="mt-1 text-[10px] text-gray-500">
                All expense payments have been processed or no payments have been recorded yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                      Payment Info
                    </th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                      Supplier
                    </th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                      Payment Details
                    </th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                      Expense Reference
                    </th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                      Created By
                    </th>
                    <th className="px-3 py-2 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-900">
                          <div className="font-medium">{payment.payment_number}</div>
                          <div className="text-[10px] text-gray-500">{formatDate(payment.payment_date)}</div>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-900">
                        {payment.supplier_name || 'Unknown Supplier'}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="space-y-1">
                          {getPaymentMethodBadge(payment.payment_method)}
                          <div className="text-[10px] text-gray-500">
                            {payment.payment_account_name} ({payment.payment_account_code})
                          </div>
                          {payment.reference && (
                            <div className="text-[10px] text-gray-500">Ref: {payment.reference}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-bold text-gray-900">
                        {formatCurrency(payment.amount, payment.currency)} {payment.currency}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-900">{payment.expense_reference || '-'}</div>
                        <div className="text-[10px] text-gray-500">
                          Journal: {payment.journal_entry_number}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-900">{payment.created_by_name || 'Unknown'}</div>
                        <div className="text-[10px] text-gray-500">
                          {formatDate(payment.created_at)}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => openActionModal(payment, 'confirm')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Confirm
                          </button>
                          <button
                            onClick={() => openActionModal(payment, 'decline')}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Decline
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Payment Action Modal */}
        {showActionModal && selectedPayment && (
          <PaymentActionModal
            isOpen={showActionModal}
            onClose={closeActionModal}
            payment={selectedPayment}
            action={actionType}
            onSubmit={handlePaymentAction}
            processing={processingAction}
          />
        )}
      </div>
    </div>
  );
};

// Payment Action Modal Component
const PaymentActionModal: React.FC<PaymentActionModalProps> = ({
  isOpen,
  onClose,
  payment,
  action,
  onSubmit,
  processing
}) => {
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (payment) {
      onSubmit(payment.id, action, reference, notes);
    }
  };

  const handleClose = () => {
    setReference('');
    setNotes('');
    onClose();
  };

  if (!isOpen || !payment) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-lg w-full max-w-sm mx-4 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-gray-900">
            {action === 'confirm' ? 'Confirm' : 'Decline'} Payment
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-3">
          <div className="bg-gray-50 p-2.5 rounded-md">
            <p className="text-[10px] text-gray-500 mb-1.5">Payment Details:</p>
            <div className="space-y-0.5 text-[10px] text-gray-700">
              <p><span className="font-medium text-gray-900">Payment Number:</span> {payment.payment_number}</p>
              <p><span className="font-medium text-gray-900">Supplier:</span> {payment.supplier_name}</p>
              <p><span className="font-medium text-gray-900">Amount:</span> {payment.amount} {payment.currency}</p>
              <p><span className="font-medium text-gray-900">Method:</span> {payment.payment_method}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div>
            <label htmlFor="reference" className="block text-[10px] font-medium text-gray-700 mb-1">
              Reference *
            </label>
            <input
              type="text"
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              placeholder="Enter reference number or description"
              required
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-[10px] font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
              placeholder="Enter additional notes (optional)"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={processing}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className={`px-3 py-1.5 text-xs font-medium text-white rounded-md transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                action === 'confirm'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {processing ? 'Processing...' : `${action === 'confirm' ? 'Confirm' : 'Decline'} Payment`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PendingPaymentsPage;