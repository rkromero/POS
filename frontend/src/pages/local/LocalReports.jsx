import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../services/api'
import toast from 'react-hot-toast'


export default function LocalReports() {
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
        const [r1, r2] = await Promise.all([
          api.get(`/reports/by-period?desde=${desde}&hasta=${hasta}&period=${period}`),
          api.get(`/reports/top-products?limit=10&desde=${desde}&hasta=${hasta}`),
        ])
        setByPeriod(r1.data)
        setTopProducts(r2.data)
      } catch { toast.error('Error al cargar reportes') }
    }
    load()
  }, [period, desde, hasta])

  const totalVentas = byPeriod.reduce((s, r) => s + parseInt(r.total_ventas || 0), 0)

  const periodData = byPeriod.map(row => ({
    name: new Date(row.periodo).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
    ventas: parseInt(row.total_ventas || 0),
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[#111111]">Mis reportes</h1>

      <div className="grid grid-cols-1 gap-4">
        <div className="card">
          <p className="text-sm text-[#444444]">Ventas en el período</p>
          <p className="text-3xl font-bold text-[#111111] mt-1">{totalVentas}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-3 items-end mb-4">
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
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={periodData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#444444' }} />
            <YAxis tick={{ fontSize: 11, fill: '#444444' }} />
            <Tooltip formatter={(v) => [v, 'Ventas']} />
            <Bar dataKey="ventas" fill="#E91E8C" radius={[4,4,0,0]} name="Ventas" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-base font-semibold text-[#111111]">Mis productos más vendidos</h2>
            <p className="text-xs text-[#444444] mt-0.5">Por Kilogramo</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-mimi-50">
                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">#</th>
                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Producto</th>
                <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Cant.</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.filter(p => p.unidad_medida === 'kg').map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="py-3 px-4 font-bold text-mimi-500">{i+1}</td>
                  <td className="py-3 px-4">{p.nombre}</td>
                  <td className="py-3 px-4 text-right">{p.total_cantidad}</td>
                </tr>
              ))}
              {topProducts.filter(p => p.unidad_medida === 'kg').length === 0 && (
                <tr><td colSpan="3" className="text-center py-8 text-[#444444]">No hay datos disponibles</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E5E7EB]">
            <h2 className="text-base font-semibold text-[#111111]">Mis productos más vendidos</h2>
            <p className="text-xs text-[#444444] mt-0.5">Por Unidad</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-mimi-50">
                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">#</th>
                <th className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Producto</th>
                <th className="text-right py-3 px-4 font-semibold text-xs uppercase tracking-wide text-[#444444]">Cant.</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.filter(p => p.unidad_medida !== 'kg').map((p, i) => (
                <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="py-3 px-4 font-bold text-mimi-500">{i+1}</td>
                  <td className="py-3 px-4">{p.nombre}</td>
                  <td className="py-3 px-4 text-right">{p.total_cantidad}</td>
                </tr>
              ))}
              {topProducts.filter(p => p.unidad_medida !== 'kg').length === 0 && (
                <tr><td colSpan="3" className="text-center py-8 text-[#444444]">No hay datos disponibles</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
