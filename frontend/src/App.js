import React from 'react';
import { BrowserRouter as Router, Route, Link, Routes } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Sales from './components/Sales';
import Clients from './components/Clients';
import Funds from './components/Funds';
import Forecast from './components/Forecast';

const App = () => {
  return (
    <Router>
      <div className="app">
        <nav>
          <ul>
            <li><Link to="/">Dashboard</Link></li>
            <li><Link to="/sales">Sales</Link></li>
            <li><Link to="/clients">Clients</Link></li>
            <li><Link to="/funds">Funds</Link></li>
            <li><Link to="/forecast">Forecast</Link></li>
          </ul>
        </nav>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/funds" element={<Funds />} />
          <Route path="/forecast" element={<Forecast />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;