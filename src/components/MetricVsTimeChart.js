import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import './MetricVsTimeChart.css';

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  return d.toLocaleDateString([], { month: 'short', year: '2-digit', day: 'numeric' });
}

export default function MetricVsTimeChart({ data = [], metricField = 'viewCount', onEnlarge }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const chartData = (data || []).map((d) => ({
    ...d,
    dateLabel: formatDate(d.date),
    value: Number(d.value),
  }));

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!chartData.length) return;
    const csv = ['date,value\n', ...chartData.map((r) => `${r.date},${r.value}`).join('\n')];
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `metric_vs_time_${metricField}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const content = (
    <div className="metric-vs-time-chart">
      <div className="metric-vs-time-header">
        <span className="metric-vs-time-label">{metricField} vs time</span>
        <div className="metric-vs-time-actions">
          <button type="button" className="metric-vs-time-dl" onClick={handleDownload}>
            Download
          </button>
          {onEnlarge && (
            <button type="button" className="metric-vs-time-enlarge" onClick={() => setLightboxOpen(true)}>
              Enlarge
            </button>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.12)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={55}
            tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v)}
          />
          <Tooltip
            contentStyle={{
              background: 'rgba(15,15,35,0.95)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10,
              color: '#e2e8f0',
            }}
            formatter={(v) => [Number(v).toLocaleString(), metricField]}
            labelFormatter={(l) => l}
          />
          <Line type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  return (
    <>
      <div className="metric-vs-time-wrap" onClick={onEnlarge ? () => setLightboxOpen(true) : undefined} role={onEnlarge ? 'button' : undefined}>
        {content}
      </div>
      {lightboxOpen && (
        <div className="metric-vs-time-lightbox" onClick={() => setLightboxOpen(false)}>
          <div className="metric-vs-time-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="metric-vs-time-lightbox-close" onClick={() => setLightboxOpen(false)}>
              ×
            </button>
            <div className="metric-vs-time-lightbox-actions">
              <button type="button" onClick={handleDownload}>
                Download CSV
              </button>
            </div>
            <div className="metric-vs-time-lightbox-chart">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" vertical={false} />
                  <XAxis dataKey="dateLabel" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }} />
                  <YAxis
                    tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 12 }}
                    tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,15,35,0.95)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      color: '#e2e8f0',
                    }}
                    formatter={(v) => [Number(v).toLocaleString(), metricField]}
                  />
                  <Line type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
