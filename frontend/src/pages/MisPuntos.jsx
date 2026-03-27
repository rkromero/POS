import { useState } from 'react';
import axios from 'axios';

const TIPO_ICON = {
  descuento: '🏷️',
  producto: '🎂',
  envio_gratis: '🚚',
};

const NIVEL_STYLES = {
  Bronce: { color: '#CD7F32', label: 'Bronce' },
  Plata:  { color: '#C0C0C0', label: 'Plata'  },
  Oro:    { color: '#FFD700', label: 'Oro'    },
};

export default function MisPuntos() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [cliente, setCliente] = useState(null);       // found customer
  const [notFound, setNotFound] = useState(false);
  const [beneficios, setBeneficios] = useState([]);
  const [modal, setModal] = useState(null);           // { beneficio }
  const [canjeLoading, setCanjeLoading] = useState(false);
  const [toast, setToast] = useState(null);           // { type: 'success'|'error', msg }

  function showToast(type, msg) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleBuscar(e) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setNotFound(false);
    setCliente(null);
    setBeneficios([]);
    try {
      const [clienteRes, beneficiosRes] = await Promise.all([
        axios.get(`/api/public/loyalty/cliente?q=${encodeURIComponent(query.trim())}`),
        axios.get('/api/public/loyalty/beneficios'),
      ]);
      setCliente(clienteRes.data);
      setBeneficios(beneficiosRes.data);
    } catch (err) {
      if (err.response?.status === 404) {
        setNotFound(true);
      } else {
        showToast('error', 'Error al conectar con el servidor. Intentá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCanje() {
    if (!modal) return;
    setCanjeLoading(true);
    try {
      const res = await axios.post('/api/public/loyalty/canje', {
        client_id: cliente.id,
        beneficio_id: modal.beneficio.id,
      });
      setCliente(res.data.cliente);
      setModal(null);
      showToast('success', `¡Canje realizado! Presentá esta pantalla en el local para recibir tu beneficio.`);
    } catch (err) {
      setModal(null);
      showToast('error', err.response?.data?.error || 'No se pudo realizar el canje.');
    } finally {
      setCanjeLoading(false);
    }
  }

  function handleVolver() {
    setCliente(null);
    setNotFound(false);
    setBeneficios([]);
    setQuery('');
  }

  const nivelStyle = cliente ? (NIVEL_STYLES[cliente.nivel] || NIVEL_STYLES.Bronce) : null;

  return (
    <div className="min-h-screen bg-amber-50 flex flex-col items-center px-4 py-8">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium max-w-sm w-full text-center transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header branding */}
      <div className="mb-6 text-center">
        <div className="text-5xl mb-1">🍞⭐</div>
        <h1 className="text-3xl font-bold text-amber-700 tracking-tight">Mimí Panadería</h1>
        <p className="text-amber-600 text-sm mt-1">Programa de fidelización</p>
      </div>

      {/* ── State 1: Lookup form ── */}
      {!cliente && !notFound && (
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">Mis Puntos</h2>
          <p className="text-gray-500 text-sm text-center mb-6">
            Consultá tu saldo y canjeá beneficios
          </p>
          <form onSubmit={handleBuscar} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono o email
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ej: 1122334455 o vos@mail.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 text-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg py-2.5 transition-colors text-sm"
            >
              {loading ? 'Buscando...' : 'Ver mis puntos'}
            </button>
          </form>
        </div>
      )}

      {/* ── State 3: Not found ── */}
      {notFound && (
        <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm text-center">
          <div className="text-4xl mb-3">🔍</div>
          <p className="text-gray-700 font-medium mb-2">
            No encontramos una cuenta con ese teléfono o email.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            Si hiciste compras con nosotros, pedile al local que registre tu número.
          </p>
          <button
            onClick={handleVolver}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg px-6 py-2.5 transition-colors text-sm"
          >
            Intentar de nuevo
          </button>
        </div>
      )}

      {/* ── State 2: Customer found ── */}
      {cliente && (
        <div className="w-full max-w-lg flex flex-col gap-5">

          {/* Points card */}
          <div className="bg-white rounded-2xl shadow-md p-6 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-1">
              Hola, {cliente.nombre}! 👋
            </h2>

            {/* Level badge */}
            <span
              className="inline-block px-3 py-0.5 rounded-full text-sm font-bold mb-4"
              style={{ backgroundColor: nivelStyle.color + '22', color: nivelStyle.color }}
            >
              Nivel {nivelStyle.label}
            </span>

            {/* Big points display */}
            <div className="bg-amber-50 rounded-xl py-5 px-4 mb-4">
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <span className="text-3xl">⭐</span>
                <span className="text-5xl font-extrabold text-amber-700">
                  {cliente.puntos_vigentes.toLocaleString('es-AR')}
                </span>
              </div>
              <p className="text-amber-600 text-sm mt-1 font-medium">puntos disponibles</p>
            </div>

            <button
              onClick={handleVolver}
              className="text-amber-600 hover:text-amber-800 text-sm underline"
            >
              Volver a buscar
            </button>
          </div>

          {/* Benefits section */}
          <div>
            <h3 className="text-lg font-bold text-gray-700 mb-3">🎁 Canjeá tus puntos</h3>

            {beneficios.length === 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center text-gray-500 text-sm">
                No hay beneficios disponibles por el momento.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {beneficios.map((b) => {
                const puedeC = cliente.puntos_vigentes >= b.puntos_necesarios;
                const faltan = b.puntos_necesarios - cliente.puntos_vigentes;
                return (
                  <div
                    key={b.id}
                    className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-2 border border-gray-100"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-base mr-1">{TIPO_ICON[b.tipo] || '🎁'}</span>
                        <span className="font-semibold text-gray-800 text-sm">{b.nombre}</span>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                        {b.puntos_necesarios.toLocaleString('es-AR')} pts
                      </span>
                    </div>

                    {b.descripcion && (
                      <p className="text-xs text-gray-500 leading-relaxed">{b.descripcion}</p>
                    )}

                    <div className="mt-auto pt-1">
                      {puedeC ? (
                        <>
                          <p className="text-xs text-green-600 font-medium mb-1.5">¡Alcanzas!</p>
                          <button
                            onClick={() => setModal({ beneficio: b })}
                            className="w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                          >
                            Canjear
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-gray-400 mb-1.5">
                            Te faltan {faltan.toLocaleString('es-AR')} puntos
                          </p>
                          <button
                            disabled
                            className="w-full bg-gray-100 text-gray-400 text-sm font-semibold rounded-lg py-2 cursor-not-allowed"
                          >
                            Canjear
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation modal ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Confirmar canje</h3>
            <p className="text-gray-600 text-sm mb-1">
              ¿Confirmás el canje de{' '}
              <span className="font-semibold text-gray-800">{modal.beneficio.nombre}</span>
              {' '}por{' '}
              <span className="font-semibold text-amber-700">
                {modal.beneficio.puntos_necesarios.toLocaleString('es-AR')} puntos
              </span>?
            </p>
            <p className="text-xs text-gray-400 mb-5">
              Mostrá esta pantalla al personal del local para recibir tu beneficio.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setModal(null)}
                disabled={canjeLoading}
                className="flex-1 border border-gray-300 text-gray-700 font-medium rounded-lg py-2.5 text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCanje}
                disabled={canjeLoading}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors disabled:opacity-50"
              >
                {canjeLoading ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-amber-400">Mimí Panadería &copy; {new Date().getFullYear()}</p>
    </div>
  );
}
