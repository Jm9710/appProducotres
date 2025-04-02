import { useState, useEffect } from 'react'
import {Route, Routes, useLocation} from 'react-router-dom'
import './App.css'

// componentes de la pagina
import Login from './components/Login'
import Home from './components/Home'
import HomeCliente from './components/HomeCliente'


const App = () => {
  const location = useLocation();

  useEffect(() => {
    switch(location.pathname) {
      case '/':
        document.title = 'SDC Taipas - Login';
        break;
      case '/home':
        document.title = 'SDC Taipas - Home Oficina';
        break;
      
      default:
        document.title = 'SDC Taipas';
    }
  }, [location]);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<Home />} />
      <Route path="/home-cliente" element={<HomeCliente />} />
    </Routes>
  )

}



export default App
