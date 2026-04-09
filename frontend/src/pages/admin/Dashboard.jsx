import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../services/api'
import toast from 'react-hot-toast'

const fmt = (v) => `$${parseFloat(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`

function StatCard({ title, value, accent }) {
  return (
    <div className="card">
      <p className="text-sm text-[#444444] font-medium">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${accent ? 'text-mimi-500' : 'text-[#111111]'}`}>{value}</p>
    </div>
  )
}

export default function AdminDashboard() {
  const [byLocal, setByLocal] = useState([])
  const [byPeriod, setByPeriod] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [period, setPeriod] = useState('day')
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    async function load() {
      try {
        const [r1, r2, r3] = await Promise.all([
          api.get('/reports/by-local'),
          api.get(`/reports/by-period?desde=${desde}&hasta=${hasta}&period=${period}`),
          api.get(`/reports/top-products?limit=10&desde=${desde}&hasta=${hasta}`),
        ])
        setByLocal(r1.data)
        setByPeriod(r2.data)
        setTopProducts(r3.data)
      } catch { toast.error('Error al cargar reportes') }
    }
    load()
  }, [period, desde, hasta])

  const totalMonto = byLocal.reduce((s, l) => s + parseFloat(l.monto_total || 0), 0)
  const totalVentas = byLocal.reduce((s, l) => s + parseInt(l.total_ventas || 0), 0)

  const periodData = byPeriod.map(row => {
    const [, m, d] = row.periodo.substring(0, 10).split('-')
    return {
      name: `${d}/${m}`,
      monto: parseFloat(row.monto_total || 0),
      ventas: parseInt(row.total_ventas || 0),
    }
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#111111]">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total ventas" value={totalVentas} />
        <StatCard title="Monto total" value={fmt(totalMonto)} accent />
        <StatCard title="Locales" value={byLocal.length} />
      </div>

      {/* Filtros */}
      <div className="card py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-[#444444] mb-1">Desde</label>
            <input type="date" className="input-field w-36 text-sm" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#444444] mb-1">Hasta</label>
            <input type="date" className="input-field w-36 text-sm" value={hasta} onChange={e => setHasta(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#444444] mb-1">Agrupar por</label>
            <select className="input-field w-32 text-sm" value={period} onChange={e => setPeriod(e.target.value)}>
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      <div className="card">
        <h2 className="text-base font-semibold text-[#111111] mb-4">Ventas por período</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={periodData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#444444' }} />
            <YAxis tick={{ fontSize: 11, fill: '#444444' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v) => fmt(v)} labelStyle={{ color: '#111111' }} />
            <Bar dataKey="monto" fill="#E91E8C" radius={[4,4,0,0]} name="Monto" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparativa */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-base font-semibold text-[#111111]">Comparativa por local</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-mimi-50">
                <th className="text-left py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Local</th>
                <th className="text-right py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Ventas</th>
                <th className="text-right py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Monto</th>
              </tr>
            </thead>
            <tbody>
              {byLocal.map((l, i) => (
                <tr key={l.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="py-3 px-4 font-medium">{l.nombre}</td>
                  <td className="py-3 px-4 text-right text-[#444444]">{l.total_ventas}</td>
                  <td className="py-3 px-4 text-right font-semibold text-mimi-500">{fmt(l.monto_total)}</td>
                </tr>
              ))}
              {byLocal.length === 0 && <tr><td colSpan="3" className="text-center py-6 text-[#444444]">Sin datos</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Top productos */}
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-base font-semibold text-[#111111]">Productos más vendidos</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-mimi-50">
                <th className="text-left py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">#</th>
                <th className="text-left py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Producto</th>
                <th className="text-right py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Cant.</th>
                <th className="text-right py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="py-3 px-4 font-bold text-mimi-500">{i + 1}</td>
                  <td className="py-3 px-4">{p.nombre}</td>
                  <td className="py-3 px-4 text-right text-[#444444]">{p.total_cantidad}</td>
                  <td className="py-3 px-4 text-right font-semibold">{fmt(p.total_monto)}</td>
                </tr>
              ))}
              {topProducts.length === 0 && <tr><td colSpan="4" className="text-center py-6 text-[#444444]">Sin datos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
