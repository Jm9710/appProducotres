<<<<<<< HEAD
import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import './App.css'
import "leaflet/dist/leaflet.css";

=======
import { useState, useEffect } from 'react'
import {Route, Router, Routes, useLocation} from 'react-router-dom'
import './App.css'
import "leaflet/dist/leaflet.css";


>>>>>>> temp-backup
// componentes de la pagina
import Login from './components/Login'
import Home from './components/Home'
import HomeCliente from './components/HomeCliente'
<<<<<<< HEAD
import HomeRelevadores from './components/HomeRelevadores' // <-- NUEVO
import PrivateRoute from './components/PrivateRoute';

=======
import PrivateRoute from './components/PrivateRoute';


>>>>>>> temp-backup
const App = () => {
  const location = useLocation();

  useEffect(() => {
<<<<<<< HEAD
    switch (location.pathname) {
=======
    switch(location.pathname) {
>>>>>>> temp-backup
      case '/':
        document.title = 'SDC Taipas - Login';
        break;
      case '/home':
        document.title = 'SDC Taipas - Home Oficina';
        break;
      case '/home-cliente':
        document.title = 'SDC Taipas - Home Cliente';
        break;
<<<<<<< HEAD
      case '/home-relevadores': // <-- NUEVO
        document.title = 'SDC Taipas - Relevadores';
        break;
=======
>>>>>>> temp-backup
      default:
        document.title = 'SDC Taipas';
    }
  }, [location]);

  return (
<<<<<<< HEAD
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
      <Route path="/home-cliente" element={<PrivateRoute><HomeCliente /></PrivateRoute>} />
      <Route path="/home-relevadores" element={<PrivateRoute><HomeRelevadores /></PrivateRoute>} /> {/* NUEVO */}
    </Routes>
  )
}

=======
    
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<PrivateRoute><Home /></PrivateRoute>} />
        
        <Route path="/home-cliente" element={<PrivateRoute><HomeCliente /></PrivateRoute>} />
      </Routes>

  )

}



>>>>>>> temp-backup
export default App
