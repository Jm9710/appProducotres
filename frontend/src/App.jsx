import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import "leaflet/dist/leaflet.css";

// componentes de la pagina
import Login from './components/Login'
import Home from './components/Home'
import HomeCliente from './components/HomeCliente'
import HomeRelevadores from './components/HomeRelevadores' // <-- NUEVO
import PrivateRoute from './components/PrivateRoute';

const App = () => {
  const location = useLocation();

  useEffect(() => {
    switch (location.pathname) {
      case '/':
        document.title = 'SDC Taipas - Login';
        break;
      case '/home':
        document.title = 'SDC Taipas - Home Oficina';
        break;
      case '/home-cliente':
        document.title = 'SDC Taipas - Home Cliente';
        break;
      case '/home-relevadores': // <-- NUEVO
        document.title = 'SDC Taipas - Relevadores';
        break;
      default:
        document.title = 'SDC Taipas';
    }
  }, [location]);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/home-cliente" element={<PrivateRoute><HomeCliente /></PrivateRoute>} />
      <Route path="/home-relevadores" element={<PrivateRoute><HomeRelevadores /></PrivateRoute>} /> {/* NUEVO */}
    </Routes>
  )
}

export default App
