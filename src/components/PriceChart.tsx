'use client'

import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'

import { Line } from 'react-chartjs-2'

ChartJS.register(
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend
)

export default function PriceChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="text-gray-400 text-sm">Sem dados suficientes</p>
  }

  const chartData = {
    labels: data.map(item => new Date(item.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Normal',
        data: data.map(item => item.normal),
      },
      {
        label: 'Foil',
        data: data.map(item => item.foil),
      },
    ],
  }

  return <Line data={chartData} />
}