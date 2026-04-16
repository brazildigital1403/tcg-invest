'use client'

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler)

export default function PriceChart({ data }: { data: any[] }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
        Sem dados históricos ainda
      </div>
    )
  }

  const chartData = {
    labels: data.map(item => new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })),
    datasets: [
      {
        label: 'Normal',
        data: data.map(item => item.normal || null),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.08)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#0f1117',
        pointBorderWidth: 2,
        borderWidth: 2,
      },
      {
        label: 'Foil',
        data: data.map(item => item.foil || null),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.06)',
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#22c55e',
        pointBorderColor: '#0f1117',
        pointBorderWidth: 2,
        borderWidth: 2,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false }, // legenda customizada abaixo
      tooltip: {
        backgroundColor: '#0d0f14',
        titleColor: 'rgba(255,255,255,0.7)',
        bodyColor: '#f0f0f0',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: any) => ` R$ ${Number(ctx.raw || 0).toFixed(2).replace('.', ',')}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: {
          color: 'rgba(255,255,255,0.3)',
          font: { size: 11 },
          callback: (v: any) => `R$ ${Number(v).toFixed(0)}`,
        },
        border: { display: false },
      },
    },
  }

  return (
    <div>
      <Line data={chartData} options={options as any} />

      {/* Legenda customizada com círculos */}
      <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Normal</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Foil</span>
        </div>
      </div>
    </div>
  )
}