import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { formatMoney, formatMoneyCompact, formatMonth } from '../format.js';
import { PALETTE, chartTokens, seriesColor, useDarkMode } from '../theme.js';
import Icon from './Icon.jsx';

ChartJS.register(ArcElement, BarElement, CategoryScale, Filler, LinearScale, LineElement, PointElement, Tooltip, Legend);
ChartJS.defaults.font.family = "'Plus Jakarta Sans', system-ui, sans-serif";

export const EmptyChart = () => (
  <div className="empty chart-empty">
    <Icon name="chart" size={28} />
    <p>No data for this period yet.</p>
  </div>
);

const tooltip = (t) => ({
  backgroundColor: t.strong,
  titleColor: t.surface,
  bodyColor: t.surface,
  padding: 10,
  cornerRadius: 8,
  boxPadding: 4,
  usePointStyle: true,
});

// Shared look: quiet axes and grid, money-formatted ticks and tooltips.
function baseOptions(t) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        align: 'end',
        labels: { color: t.text, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 8, boxHeight: 8 },
      },
      tooltip: {
        ...tooltip(t),
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: t.text } },
      y: {
        grid: { color: t.grid },
        border: { display: false },
        ticks: { color: t.text, callback: (v) => formatMoneyCompact(v), maxTicksLimit: 6 },
      },
    },
  };
}

export function MonthlyBarChart({ monthly }) {
  const dark = useDarkMode();
  if (!monthly.length) return <EmptyChart />;
  const t = chartTokens(dark);

  const bar = { borderRadius: 6, borderSkipped: 'start', categoryPercentage: 0.65, barPercentage: 0.85 };
  const data = {
    labels: monthly.map((m) => formatMonth(m.month)),
    datasets: [
      { ...bar, label: 'Income', data: monthly.map((m) => m.income), backgroundColor: seriesColor(PALETTE[0], dark) },
      { ...bar, label: 'Expenses', data: monthly.map((m) => m.expense), backgroundColor: seriesColor(PALETTE[1], dark) },
    ],
  };
  return (
    <div className="chart-box">
      <Bar data={data} options={baseOptions(t)} role="img" aria-label="Bar chart of income and expenses per month" />
    </div>
  );
}

export function BalanceLineChart({ monthly }) {
  const dark = useDarkMode();
  if (!monthly.length) return <EmptyChart />;
  const t = chartTokens(dark);
  const color = seriesColor(PALETTE[6], dark);

  let running = 0;
  const balances = monthly.map((m) => (running += m.income - m.expense));

  const options = baseOptions(t);
  options.plugins.legend = { display: false }; // one series: the card title names it

  const data = {
    labels: monthly.map((m) => formatMonth(m.month)),
    datasets: [
      {
        label: 'Balance',
        data: balances,
        borderColor: color,
        borderWidth: 2.5,
        tension: 0.35,
        fill: 'origin',
        // Soft fade from the line down to the axis.
        backgroundColor: ({ chart }) => {
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'transparent';
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${color}55`);
          gradient.addColorStop(1, `${color}00`);
          return gradient;
        },
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: color,
        pointBorderColor: t.surface,
        pointBorderWidth: 2,
      },
    ],
  };
  return (
    <div className="chart-box">
      <Line data={data} options={options} role="img" aria-label="Line chart of running balance per month" />
    </div>
  );
}

export function CategoryDoughnut({ byCategory }) {
  const dark = useDarkMode();
  if (!byCategory.length) return <EmptyChart />;
  const t = chartTokens(dark);
  const total = byCategory.reduce((sum, c) => sum + c.total, 0);

  // Writes the total spending in the hole of the doughnut.
  const centerText = {
    id: 'centerText',
    afterDraw(chart) {
      const { ctx, chartArea } = chart;
      const x = (chartArea.left + chartArea.right) / 2;
      const y = (chartArea.top + chartArea.bottom) / 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = t.text;
      ctx.font = `500 12px ${ChartJS.defaults.font.family}`;
      ctx.fillText('Total spent', x, y - 11);
      ctx.fillStyle = t.strong;
      ctx.font = `700 17px ${ChartJS.defaults.font.family}`;
      ctx.fillText(formatMoney(total), x, y + 9);
      ctx.restore();
    },
  };

  const data = {
    labels: byCategory.map((c) => c.name),
    datasets: [
      {
        data: byCategory.map((c) => c.total),
        backgroundColor: byCategory.map((c) => seriesColor(c.color, dark)),
        borderColor: t.surface,
        borderWidth: 3,
        borderRadius: 6,
        hoverOffset: 6,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    layout: { padding: 6 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: t.text, usePointStyle: true, pointStyle: 'rectRounded', boxWidth: 8, boxHeight: 8, padding: 12 },
      },
      tooltip: {
        ...tooltip(t),
        callbacks: {
          label: (ctx) => ` ${formatMoney(ctx.parsed)} (${Math.round((ctx.parsed / total) * 100)}%)`,
        },
      },
    },
  };
  return (
    <div className="chart-box">
      <Doughnut
        data={data}
        options={options}
        plugins={[centerText]}
        role="img"
        aria-label="Doughnut chart of spending by category"
      />
    </div>
  );
}
