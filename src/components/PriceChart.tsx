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

interface PriceChartProps {
  data: { date: string; normal?: number | null; foil?: number | null; min?: number | null; max?: number | null }[]
}

export default function PriceChart({ data }: PriceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: 140, gap: 8, color: 'rgba(255,255,255,0.2)',
      }}>
        <span style={{ fontSize: 28 }}>📊</span>
        <span style={{ fontSize: 13 }}>Histórico aparece após atualizar o preço</span>
      </div>
    )
  }

  // Se só tem 1 ponto, duplica para mostrar a linha
  const chartData = data.length === 1 ? [data[0], data[0]] : data

  const hasNormal = chartData.some(d => d.normal != null)
  const hasFoil = chartData.some(d => d.foil != null)

  const labels = chartData.map(d => {
    const date = new Date(d.date + 'T12:00:00')
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  })

  const datasets = []

  if (hasNormal) {
    datasets.push({
      label: 'Normal',
      data: chartData.map(d => d.normal ?? null),
      borderColor: '#f59e0b',
      backgroundColor: 'rgba(245,158,11,0.08)',
      tension: 0.4, fill: true,
      pointRadius: chartData.length <= 7 ? 4 : 2,
      pointBackgroundColor: '#f59e0b',
      pointBorderColor: '#0f1117',
      pointBorderWidth: 2,
      borderWidth: 2,
    })
  }

  if (hasFoil) {
    datasets.push({
      label: 'Foil',
      data: chartData.map(d => d.foil ?? null),
      borderColor: '#60a5fa',
      backgroundColor: 'rgba(96,165,250,0.06)',
      tension: 0.4, fill: true,
      pointRadius: chartData.length <= 7 ? 4 : 2,
      pointBackgroundColor: '#60a5fa',
      pointBorderColor: '#0f1117',
      pointBorderWidth: 2,
      borderWidth: 2,
    })
  }

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d0f14',
        titleColor: 'rgba(255,255,255,0.5)',
        bodyColor: '#f0f0f0',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (ctx: any) => {
            const val = Number(ctx.raw || 0)
            return ` ${ctx.dataset.label}: R$ ${val.toFixed(2).replace('.', ',')}`
          },
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
          callback: (v: any) => `R$ ${Number(v).toFixed(2).replace('.', ',')}`,
        },
        border: { display: false },
      },
    },
  }

  // Calcula variação do período
  const firstNormal = chartData.find(d => d.normal != null)?.normal
  const lastNormal = [...chartData].reverse().find(d => d.normal != null)?.normal
  const variacao = firstNormal && lastNormal && firstNormal > 0
    ? ((lastNormal - firstNormal) / firstNormal) * 100
    : null

  return (
    <div>
      {variacao !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: variacao >= 0 ? '#22c55e' : '#ef4444',
            background: variacao >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            padding: '3px 10px', borderRadius: 20,
          }}>
            {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao).toFixed(1)}% no período
          </span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            {data.length} registro{data.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      <Line data={{ labels, datasets }} options={options as any} />

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 14 }}>
        {hasNormal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Normal</span>
          </div>
        )}
        {hasFoil && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#60a5fa' }} />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Foil</span>
          </div>
        )}
      </div>
    </div>
  )
}