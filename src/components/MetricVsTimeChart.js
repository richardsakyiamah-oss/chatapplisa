import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './MetricVsTimeChart.css';

export default function MetricVsTimeChart({ data, metricField }) {
  const [enlarged, setEnlarged] = useState(false);

  const formatMetricName = (field) => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const formatValue = (value) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const handleDownload = () => {
    const csv = [
      ['Date', formatMetricName(metricField), 'Title'],
      ...data.map((d) => [d.date, d.value, d.title]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${metricField}_vs_time.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chart = (
    <div className={`metric-chart ${enlarged ? 'enlarged' : ''}`}>
      <div className="metric-chart-header">
        <h3>{formatMetricName(metricField)} Over Time</h3>
        {enlarged && (
          <div className="metric-chart-actions">
            <button onClick={handleDownload} className="chart-download-btn">
              Download CSV
            </button>
            <button onClick={() => setEnlarged(false)} className="chart-close-btn">
              ×
            </button>
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={enlarged ? 500 : 300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
          <YAxis stroke="rgba(255,255,255,0.6)" tickFormatter={formatValue} />
          <Tooltip
            contentStyle={{
              background: 'rgba(0, 0, 0, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '4px',
              color: '#fff',
            }}
            formatter={(value) => [formatValue(value), formatMetricName(metricField)]}
          />
          <Line type="monotone" dataKey="value" stroke="#ffd700" strokeWidth={2} dot={{ fill: '#ffd700' }} />
        </LineChart>
      </ResponsiveContainer>
      {!enlarged && (
        <button onClick={() => setEnlarged(true)} className="chart-enlarge-btn">
          Click to enlarge
        </button>
      )}
    </div>
  );

  if (enlarged) {
    return (
      <div className="chart-overlay" onClick={() => setEnlarged(false)}>
        <div onClick={(e) => e.stopPropagation()}>{chart}</div>
      </div>
    );
  }

  return chart;
}
