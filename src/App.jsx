import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const handlePathChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', handlePathChange);
    return () => window.removeEventListener('popstate', handlePathChange);
  }, []);

  if (path === '/cocina') return <CocinaScreen />;
  if (path === '/clientes') return <ClientesScreen />;
  if (path === '/mesero') return <MeseroScreen />;
  return <POSScreen />;
}

function POSScreen() {
  const [mesas, setMesas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [mesaSeleccionada, setMesaSeleccionada] = useState(null);
  const [carrito, setCarrito] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchMesas();
    fetchCategorias();
    fetchProductos();
  }, []);

  const fetchMesas = async () => {
    const { data } = await supabase.from('mesas').select('*').order('numero');
    setMesas(data || []);
  };

  const fetchCategorias = async () => {
    const { data } = await supabase.from('categorias').select('*').order('orden');
    setCategorias(data || []);
  };

  const fetchProductos = async () => {
    const { data } = await supabase.from('productos').select('*').eq('activo', true);
    setProductos(data || []);
  };

  const agregarAlCarrito = (producto) => {
    const itemExistente = carrito.find(item => item.id === producto.id);
    if (itemExistente) {
      setCarrito(carrito.map(item => item.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item));
    } else {
      setCarrito([...carrito, { ...producto, cantidad: 1 }]);
    }
    setTotal(total + parseFloat(producto.precio));
  };

  const enviarPedido = async () => {
    if (carrito.length === 0) return;
    const { error } = await supabase
      .from('pedidos')
      .insert([{ mesa_id: mesaSeleccionada.id, items: carrito, total, estado: 'nuevo' }]);
    if (!error) {
      setCarrito([]);
      setTotal(0);
      alert('Pedido enviado a cocina!');
    }
  };

  const seleccionarMesa = (mesa) => {
    setMesaSeleccionada(mesa);
    // Cargar pedido actual de la mesa si existe
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <h1 className="text-3xl font-bold text-blue-600 mb-4">Restify Iván - POS</h1>
      
      {/* Plan de mesas */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {mesas.map(mesa => (
          <button
            key={mesa.id}
            onClick={() => seleccionarMesa(mesa)}
            className={`p-4 rounded ${mesaSeleccionada?.id === mesa.id ? 'bg-blue-500 text-white' : mesa.estado === 'libre' ? 'bg-green-200' : 'bg-red-200'}`}
          >
            Mesa {mesa.numero}
          </button>
        ))}
      </div>

      {mesaSeleccionada && (
        <>
          {/* Categorías */}
          <div className="mb-4">
            {categorias.map(cat => (
              <h2 key={cat.id} className="text-xl font-bold mb-2">{cat.nombre}</h2>
            ))}
          </div>

          {/* Productos */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            {productos.map(producto => (
              <button
                key={producto.id}
                onClick={() => agregarAlCarrito(producto)}
                className="bg-white p-4 rounded shadow hover:bg-gray-50"
              >
                <img src={producto.imagen || '/placeholder.jpg'} alt={producto.nombre} className="w-full h-20 object-cover mb-2" />
                <p className="font-bold">{producto.nombre}</p>
                <p>${producto.precio}</p>
              </button>
            ))}
          </div>

          {/* Carrito */}
          <div className="bg-white p-4 rounded shadow">
            <h3>Carrito - Total: ${total.toFixed(2)}</h3>
            {carrito.map(item => (
              <div key={item.id} className="flex justify-between">
                <span>{item.nombre} x{item.cantidad}</span>
                <span>${(item.precio * item.cantidad).toFixed(2)}</span>
              </div>
            ))}
            <button onClick={enviarPedido} className="bg-green-500 text-white px-4 py-2 mt-2">Enviar a Cocina</button>
          </div>
        </>
      )}
    </div>
  );
}

function CocinaScreen() {
  const [pedidos, setPedidos] = useState([]);

  useEffect(() => {
    const fetchPedidos = async () => {
      const { data } = await supabase.from('pedidos').select('*').eq('estado', 'nuevo').order('created_at');
      setPedidos(data || []);
    };
    fetchPedidos();
    const channel = supabase.channel('pedidos').on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, fetchPedidos).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const marcarListo = async (id) => {
    await supabase.from('pedidos').update({ estado: 'listo' }).eq('id', id);
  };

  return (
    <div className="min-h-screen bg-red-100 p-4">
      <h1 className="text-3xl font-bold text-red-600 mb-4">Cocina - Pedidos Nuevos</h1>
      {pedidos.map(pedido => (
        <div key={pedido.id} className="bg-white p-4 mb-4 rounded shadow">
          <p>Mesa: {pedido.mesa_id}</p>
          <ul>{pedido.items.map(item => <li key={item.id}>{item.nombre} x{item.cantidad}</li>)}</ul>
          <button onClick={() => marcarListo(pedido.id)} className="bg-green-500 text-white px-4 py-2">Listo</button>
        </div>
      ))}
    </div>
  );
}

function ClientesScreen() {
  const [pedidosListos, setPedidosListos] = useState([]);

  useEffect(() => {
    const fetchListos = async () => {
      const { data } = await supabase.from('pedidos').select('*').eq('estado', 'listo').order('updated_at', { ascending: false }).limit(10);
      setPedidosListos(data || []);
    };
    fetchListos();
    const interval = setInterval(fetchListos, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-green-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-5xl font-bold text-green-600 mb-8">¡Pedidos Listos!</h1>
      <div className="grid grid-cols-2 gap-4">
        {pedidosListos.map(pedido => (
          <div key={pedido.id} className="bg-white p-6 rounded-lg shadow text-center">
            <h2 className="text-3xl font-bold">Mesa {pedido.mesa_id}</h2>
            <p className="text-green-600">¡Listo para recoger!</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeseroScreen() {
  return (
    <div className="min-h-screen bg-yellow-100 p-4">
      <h1 className="text-3xl font-bold text-yellow-600 mb-4">Panel Mesero</h1>
      <p>Aquí vas por mesas y tomas pedidos rápidos.</p>
      {/* Similar al POS pero simplificado */}
    </div>
  );
}

export default App;
