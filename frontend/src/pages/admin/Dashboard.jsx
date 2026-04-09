import { useState, useEffect } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
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

function ResultTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-lg shadow-md p-3 text-sm">
      <p className="font-semibold text-[#111111] mb-2">{label}</p>
      <p className="text-green-600">Ventas: {fmt(d?.total_ventas)}</p>
      <p className="text-red-500">Gastos: {fmt(d?.total_gastos)}</p>
      <p className="text-orange-500">Merma: {fmt(d?.total_merma)}</p>
      <p className={`font-bold mt-1 border-t border-[#E5E7EB] pt-1 ${parseFloat(d?.resultado) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        Resultado: {fmt(d?.resultado)}
      </p>
    </div>
  )
}

export default function AdminDashboard() {
  const [byLocal, setByLocal] = useState([])
  const [byPeriod, setByPeriod] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [byCashier, setByCashier] = useState([])
  const [dailyResult, setDailyResult] = useState([])
  const [gastosKpi, setGastosKpi] = useState(null)
  const [users, setUsers] = useState([])
  const [period, setPeriod] = useState('day')
  const [localId, setLocalId] = useState('')
  const [cajeroId, setCajeroId] = useState('')
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    async function load() {
      try {
        const periodParams = new URLSearchParams({ desde, hasta, period })
        if (localId) periodParams.set('local_id', localId)

        const cashierParams = new URLSearchParams({ desde, hasta })
        if (localId) cashierParams.set('local_id', localId)
        if (cajeroId) cashierParams.set('user_id', cajeroId)

        const resultParams = new URLSearchParams({ desde, hasta })
        if (localId) resultParams.set('local_id', localId)

        const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
          api.get('/reports/by-local'),
          api.get(`/reports/by-period?${periodParams}`),
          api.get(`/reports/top-products?limit=10&desde=${desde}&hasta=${hasta}`),
          api.get(`/reports/by-cashier?${cashierParams}`),
          api.get('/users?limit=100'),
          api.get(`/reports/daily-result?${resultParams}`),
          api.get(`/reports/gastos-kpi?${resultParams}`),
        ])
        setByLocal(r1.data)
        setByPeriod(r2.data)
        setTopProducts(r3.data)
        setByCashier(r4.data)
        setUsers(r5.data.data || [])
        setDailyResult(r6.data)
        setGastosKpi(r7.data)
      } catch { toast.error('Error al cargar reportes') }
    }
    load()
  }, [period, desde, hasta, localId, cajeroId])

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

  const resultData = dailyResult
    .filter(row =>
      parseFloat(row.total_ventas) > 0 ||
      parseFloat(row.total_gastos) > 0 ||
      parseFloat(row.total_merma) > 0
    )
    .map(row => {
      const [, m, d] = row.dia.substring(0, 10).split('-')
      return {
        name: `${d}/${m}`,
        resultado: parseFloat(row.resultado),
        total_ventas: parseFloat(row.total_ventas),
        total_gastos: parseFloat(row.total_gastos),
        total_merma: parseFloat(row.total_merma),
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
          <div>
            <label className="block text-xs font-medium text-[#444444] mb-1">Local</label>
            <select className="input-field w-40 text-sm" value={localId} onChange={e => setLocalId(e.target.value)}>
              <option value="">Todos</option>
              {byLocal.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Gráfico ventas por período */}
      <div className="card">
        <h2 className="text-base font-semibold text-[#111111] mb-4">
          Ventas por período{localId ? ` — ${byLocal.find(l => String(l.id) === String(localId))?.nombre}` : ''}
        </h2>
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

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-[#444444] font-medium">Mercadería / Ventas</p>
          {gastosKpi?.pctMercaderia != null ? (
            <>
              <p className="text-3xl font-bold mt-1 text-[#111111]">
                {gastosKpi.pctMercaderia.toFixed(1)}%
              </p>
              <p className="text-xs text-[#444444] mt-1">
                {fmt(gastosKpi.mercaderia)} sobre {fmt(gastosKpi.totalVentas)}
              </p>
            </>
          ) : (
            <p className="text-3xl font-bold mt-1 text-[#444444]">—</p>
          )}
        </div>
        <div className="card">
          <p className="text-sm text-[#444444] font-medium">&nbsp;</p>
          <p className="text-3xl font-bold mt-1 text-[#444444]">—</p>
        </div>
        <div className="card">
          <p className="text-sm text-[#444444] font-medium">&nbsp;</p>
          <p className="text-3xl font-bold mt-1 text-[#444444]">—</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comparativa por local */}
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

      {/* Ventas por cajero */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#111111]">Ventas por cajero</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#444444]">Cajero:</label>
            <select
              className="input-field w-44 text-sm"
              value={cajeroId}
              onChange={e => setCajeroId(e.target.value)}
            >
              <option value="">Todos</option>
              {users.filter(u => u.role !== 'admin').map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-mimi-50">
              <th className="text-left py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Cajero</th>
              <th className="text-left py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Local</th>
              <th className="text-right py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Ventas</th>
              <th className="text-right py-3 px-4 font-semibold text-xs text-[#444444] uppercase tracking-wide">Monto</th>
            </tr>
          </thead>
          <tbody>
            {byCashier.map((c, i) => (
              <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="py-3 px-4 font-medium">{c.nombre}</td>
                <td className="py-3 px-4 text-[#444444]">{c.local_nombre}</td>
                <td className="py-3 px-4 text-right text-[#444444]">{c.total_ventas}</td>
                <td className="py-3 px-4 text-right font-semibold text-mimi-500">{fmt(c.monto_total)}</td>
              </tr>
            ))}
            {byCashier.length === 0 && <tr><td colSpan="4" className="text-center py-6 text-[#444444]">Sin datos</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Resultado diario */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#111111]">Resultado diario</h2>
            <p className="text-xs text-[#444444] mt-0.5">Ventas − Gastos − Merma</p>
          </div>
          <div className="flex gap-4 text-xs text-[#444444]">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-green-500"></span>Positivo</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded bg-red-500"></span>Negativo</span>
          </div>
        </div>
        {resultData.length === 0 ? (
          <p className="text-center text-[#444444] py-10 text-sm">Sin datos en el período seleccionado</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={resultData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#444444' }} />
              <YAxis tick={{ fontSize: 11, fill: '#444444' }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
              <ReferenceLine y={0} stroke="#999" strokeDasharray="4 2" />
              <Tooltip content={<ResultTooltip />} />
              <Bar dataKey="resultado" radius={[4,4,0,0]} name="Resultado">
                {resultData.map((entry, i) => (
                  <Cell key={i} fill={entry.resultado >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
