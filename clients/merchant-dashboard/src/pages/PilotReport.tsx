import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pilotReportsApi } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function PilotReport() {
  const [report, setReport] = useState<any>(null);
  const [funnel, setFunnel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const loadReport = async () => {
      try {
        setError(null);
        const [reportResponse, funnelResponse] = await Promise.all([
          pilotReportsApi.getWeeklyReport(),
          pilotReportsApi.getOnboardingFunnel().catch(() => null),
        ]);
        setReport(reportResponse.data);
        setFunnel(funnelResponse?.data || null);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load pilot report');
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [user, navigate]);

  const exportJson = () => {
    const dataStr = JSON.stringify({ report, funnel }, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pilot-report-${report?.week || 'current'}.json`;
    link.click();
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading pilot report...</div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>Pilot Report</h1>
          <button onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
        <div style={{ padding: '2rem', border: '2px solid #ff4444', borderRadius: '8px', backgroundColor: '#ffeeee', color: '#cc0000' }}>
          <h3>Error Loading Report</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Pilot Report - Week {report?.week}</h1>
        <div>
          <button onClick={exportJson} style={{ marginRight: '1rem', padding: '0.5rem 1rem' }}>
            Export JSON
          </button>
          <button onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem 1rem' }}>
            Back to Dashboard
          </button>
        </div>
      </div>

      {report?.summary && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ padding: '1rem', border: '1px solid #4caf50', borderRadius: '8px', backgroundColor: '#e8f5e9', marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0, color: '#2e7d32' }}>✓ What Improved This Week</h3>
            <ul>
              {report.summary.improved.map((item: string, idx: number) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
          {report.summary.needsFixing.length > 0 && (
            <div style={{ padding: '1rem', border: '1px solid #ff9800', borderRadius: '8px', backgroundColor: '#fff3e0' }}>
              <h3 style={{ marginTop: 0, color: '#e65100' }}>⚠️ What Needs Fixing Next</h3>
              <ul>
                {report.summary.needsFixing.map((item: string, idx: number) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {funnel && (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
          <h3>Onboarding Funnel</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <div>
              <strong>Time to Location:</strong> {funnel.durations.timeToLocationMinutes ? `${funnel.durations.timeToLocationMinutes} minutes` : 'N/A'}
            </div>
            <div>
              <strong>Time to Staff:</strong> {funnel.durations.timeToStaffMinutes ? `${funnel.durations.timeToStaffMinutes} minutes` : 'N/A'}
            </div>
            <div>
              <strong>Time to Device:</strong> {funnel.durations.timeToDeviceMinutes ? `${funnel.durations.timeToDeviceMinutes} minutes` : 'N/A'}
            </div>
            <div>
              <strong>Time to First Scan:</strong> {funnel.durations.timeToFirstScanMinutes ? `${funnel.durations.timeToFirstScanMinutes} minutes` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {report?.metrics && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Weekly Metrics</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
              <strong>Active Customers</strong>
              <p style={{ fontSize: '1.5rem', margin: 0 }}>{report.metrics.weekly.activeCustomers}</p>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
              <strong>Repeat Customers</strong>
              <p style={{ fontSize: '1.5rem', margin: 0 }}>{report.metrics.weekly.repeatCustomers}</p>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
              <strong>Total Transactions</strong>
              <p style={{ fontSize: '1.5rem', margin: 0 }}>{report.metrics.weekly.transactionsTotal}</p>
            </div>
            <div style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
              <strong>Redemption Rate</strong>
              <p style={{ fontSize: '1.5rem', margin: 0 }}>{(report.metrics.weekly.transactionsIssue > 0 ? (report.metrics.weekly.transactionsRedeem / report.metrics.weekly.transactionsIssue * 100) : 0).toFixed(1)}%</p>
            </div>
          </div>

          <h4>Daily Breakdown</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ccc' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Active Customers</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Issues</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Redeems</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Errors</th>
              </tr>
            </thead>
            <tbody>
              {report.metrics.daily.map((day: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{day.date}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{day.activeCustomers}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{day.transactionsIssue}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>{day.transactionsRedeem}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', color: day.scanErrorsTotal > 0 ? '#d32f2f' : 'inherit' }}>
                    {day.scanErrorsTotal}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report?.topRewards && report.topRewards.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3>Top Rewards This Week</h3>
          <ul>
            {report.topRewards.map((reward: any, idx: number) => (
              <li key={idx}>
                <strong>{reward.rewardName}</strong>: {reward.redemptionCount} redemptions
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
