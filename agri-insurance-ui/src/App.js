// src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Navbar, Nav, Container } from 'react-bootstrap';
import Dashboard from './components/Dashboard';
import PurchasePolicy from './components/PurchasePolicy';
import WeatherSimulator from './components/WeatherSimulator';
import 'bootstrap/dist/css/bootstrap.min.css';

function App() {
  return (
    <Router>
      <Navbar bg="dark" variant="dark" expand="lg">
        <Container>
          <Navbar.Brand as={Link} to="/">Agri-Insurance</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/">Dashboard</Nav.Link>
              <Nav.Link as={Link} to="/purchase">Purchase Policy</Nav.Link>
              <Nav.Link as={Link} to="/weather-simulator">Weather Simulator</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/purchase" element={<PurchasePolicy />} />
        <Route path="/weather-simulator" element={<WeatherSimulator />} />
      </Routes>
    </Router>
  );
}

export default App;
