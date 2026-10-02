import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const WARNING_TIMEOUT = 9 * 60 * 1000; // 9 minutes (1 minute warning)

const AutoLogout: React.FC = () => {
  const { user, logout } = useAuth();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showWarning, setShowWarning] = useState(false);

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
  };

  const resetTimer = () => {
    clearTimers();
    setShowWarning(false);

    if (!user) return;

    // Show a non-blocking warning banner 1 minute before logout.
    // (window.confirm/alert are synchronous and freeze the JS thread while open,
    // which would prevent the actual logout timer below from ever firing if the
    // user is genuinely away and never dismisses the dialog.)
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
    }, WARNING_TIMEOUT);

    timeoutRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);
  };

  const handleUserActivity = () => {
    resetTimer();
  };

  useEffect(() => {
    if (!user) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown'
    ];

    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    resetTimer();

    return () => {
      clearTimers();
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!showWarning) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] bg-white border border-amber-300 rounded-md shadow-lg px-4 py-3 max-w-xs">
      <p className="text-xs font-semibold text-gray-900">Still there?</p>
      <p className="text-[11px] text-gray-600 mt-1">
        You'll be logged out in 1 minute due to inactivity.
      </p>
      <button
        onClick={resetTimer}
        className="mt-2 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-red-600 hover:bg-red-700"
      >
        Stay Logged In
      </button>
    </div>
  );
};

export default AutoLogout;
