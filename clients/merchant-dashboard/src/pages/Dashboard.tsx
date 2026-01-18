import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi, fraudSignalsApi } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [signals, setSignals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadDashboard = async () => {
      try {
        setError(null);
        const [dashboardResponse, signalsResponse] = await Promise.all([
          analyticsApi.getDashboard(),
          fraudSignalsApi.getSignals().catch(() => null), // Optional, don't fail if unavailable
        ]);
        setData(dashboardResponse.data);
        setSignals(signalsResponse?.data || null);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadDashboard, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading dashboard...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Merchant Dashboard</h1>
        <div>
          <button onClick={() => navigate('/pilot-report')} style={{ marginRight: '1rem', padding: '0.5rem 1rem' }}>
            Pilot Report
          </button>
          <button onClick={logout} style={{ padding: '0.5rem 1rem' }}>Logout</button>
        </div>
      </div>
        <div style={{ 
          padding: '2rem', 
          border: '2px solid #ff4444', 
          borderRadius: '8px', 
          backgroundColor: '#ffeeee',
          color: '#cc0000'
        }}>
          <h3>Error Loading Dashboard</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = data && data.totalCustomers === 0 && data.totalTransactions === 0;
  const hasSignals = signals && signals.signals && signals.signals.length > 0;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Merchant Dashboard</h1>
        <button onClick={logout} style={{ padding: '0.5rem 1rem' }}>Logout</button>
      </div>

      {error && (
        <div style={{ 
          padding: '1rem', 
          border: '1px solid #ffaa00', 
          borderRadius: '8px', 
          backgroundColor: '#fff8e1',
          color: '#e65100',
          marginBottom: '1rem'
        }}>
          ⚠️ Warning: {error}
        </div>
      )}

      {hasSignals && (
        <div style={{ 
          padding: '1rem', 
          border: '1px solid #ff6600', 
          borderRadius: '8px', 
          backgroundColor: '#fff3e0',
          marginBottom: '1rem'
        }}>
          <h3 style={{ marginTop: 0 }}>⚠️ Activity Signals</h3>
          <ul>
            {signals.signals.map((signal: string, idx: number) => (
              <li key={idx}>{signal}</li>
            ))}
          </ul>
          <small>
            Scans (last hour): {signals.scansLastHour} | 
            Redemptions (last day): {signals.redemptionsLastDay} |
            Failed (last day): {signals.failedRedemptionsLastDay}
          </small>
        </div>
      )}

      {isEmpty ? (
        <div style={{ 
          padding: '4rem 2rem', 
          textAlign: 'center',
          border: '2px dashed #ccc',
          borderRadius: '8px',
          backgroundColor: '#f5f5f5'
        }}>
          <h2>Welcome to SharkBand!</h2>
          <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
            You haven't processed any transactions yet.
          </p>
          <p style={{ color: '#888' }}>
            Start by setting up your staff devices and processing your first customer scan.
          </p>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#fff' }}>
              <h3 style={{ marginTop: 0, color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                Total Customers
              </h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0, color: '#1976d2' }}>
                {data?.totalCustomers || 0}
              </p>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#fff' }}>
              <h3 style={{ marginTop: 0, color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                Total Transactions
              </h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0, color: '#388e3c' }}>
                {data?.totalTransactions || 0}
              </p>
            </div>
            <div style={{ border: '1px solid #ccc', padding: '1.5rem', borderRadius: '8px', backgroundColor: '#fff' }}>
              <h3 style={{ marginTop: 0, color: '#666', fontSize: '0.9rem', textTransform: 'uppercase' }}>
                Total Balance
              </h3>
              <p style={{ fontSize: '2.5rem', fontWeight: 'bold', margin: 0, color: '#f57c00' }}>
                {data?.totalBalance || 0}
              </p>
            </div>
          </div>

          <div style={{ 
            padding: '1rem', 
            border: '1px solid #4caf50', 
            borderRadius: '8px', 
            backgroundColor: '#e8f5e9',
            color: '#2e7d32'
          }}>
            ✓ Dashboard is operational. Last updated: {new Date().toLocaleTimeString()}
          </div>
        </>
      )}
    </div>
  );
}
