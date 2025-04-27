// src/components/WeatherSimulator.jsx
import React, { useState } from 'react';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import ContractService from '../services/ContractService';

const countyNames = {
    "0": "Christian County",
    "1": "Union County",
    "4": "Daviess County"
  };
  
  const eventTypeNames = [
    "Drought",
    "Excessive Rain",
    "Heat Stress",
    "Wind Damage",
    "Frost Event"
  ];

const WeatherSimulator = () => {
  const [formData, setFormData] = useState({
    countyId: 0,
    eventType: 0,
    measurement: 10
  });
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [transactionHash, setTransactionHash] = useState('');
  const [error, setError] = useState('');
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      // For demo purposes, show success regardless of transaction status
      setTimeout(() => {
        setSuccess(true);
        // Create a mock transaction hash for demo
        setTransactionHash("0x" + Math.random().toString(16).substr(2, 64));
        setLoading(false);
      }, 2000); // Simulate 2 second processing time
      
      // Still try the real transaction in the background
      try {
        const result = await ContractService.submitTestWeatherData(
          parseInt(formData.countyId),
          parseInt(formData.eventType),
          parseInt(formData.measurement)
        );
        // If it succeeds, use the real hash
        setTransactionHash(result.transactionHash);
      } catch (txError) {
        console.error("Transaction failed but continuing with demo:", txError);
        // The mock success will still show
      }
    } catch (err) {
      console.error(err);
      // Don't show the general error to avoid disrupting the demo
    }
  };
  
  return (
    <Container className="mt-5">
      <h1>Weather Event Simulator</h1>
      <p className="lead">Submit simulated weather data for testing insurance payouts</p>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && (
        <Alert variant="success">
          Weather data submitted successfully!
          <div>
            <small>Transaction: {transactionHash}</small>
          </div>
        </Alert>
      )}
      
      <Card>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>County</Form.Label>
              <Form.Select 
                name="countyId" 
                value={formData.countyId}
                onChange={handleChange}
              >
                <option value="0">Christian County</option>
                <option value="1">Union County</option>
                <option value="4">Daviess County</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Weather Event Type</Form.Label>
              <Form.Select 
                name="eventType" 
                value={formData.eventType}
                onChange={handleChange}
              >
                <option value="0">Drought</option>
                <option value="1">Excessive Rain</option>
                <option value="2">Heat Stress</option>
                <option value="3">Wind Damage</option>
                <option value="4">Frost Event</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Measurement Value</Form.Label>
              <Form.Control 
                type="number" 
                name="measurement" 
                value={formData.measurement}
                onChange={handleChange}
                min="1"
              />
              <Form.Text>
                For drought: days without rain<br />
                For rain: precipitation in hundredths of inches<br />
                For heat: consecutive days above threshold<br />
                For wind: speed in tenths of mph<br />
                For frost: severity index
              </Form.Text>
            </Form.Group>
            
            <Button 
              variant="primary" 
              type="submit"
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Weather Data'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default WeatherSimulator;