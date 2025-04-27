// src/components/PurchasePolicy.jsx
import { ethers } from 'ethers';
import React, { useState } from 'react';
import { Form, Button, Container, Card, Alert } from 'react-bootstrap';
import ContractService from '../services/ContractService';

const PurchasePolicy = () => {
  const [formData, setFormData] = useState({
    countyId: 0,
    acres: 10,
    coveragePerAcre: 100,
    months: 3,
    droughtCovered: true,
    excessiveRainCovered: false,
    heatStressCovered: true,
    windDamageCovered: false,
    frostEventCovered: false
  });
  
  const [premium, setPremium] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  const calculatePremium = async () => {
    try {
      setLoading(true);
      // For demo with limited test ETH, use a very small calculation
      const basePremium = (formData.acres * formData.coveragePerAcre * 0.0001); // Reduced by 500x
      const eventCount = [
        formData.droughtCovered,
        formData.excessiveRainCovered,
        formData.heatStressCovered,
        formData.windDamageCovered,
        formData.frostEventCovered
      ].filter(Boolean).length;
      
      const eventMultiplier = 1 + (eventCount * 0.1);
      const calculatedPremium = basePremium * eventMultiplier * (formData.months / 3);
      
      setPremium(calculatedPremium);
    } catch (err) {
      console.error(err);
      setError('Failed to calculate premium');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      
      const coveredEvents = [
        formData.droughtCovered,
        formData.excessiveRainCovered,
        formData.heatStressCovered,
        formData.windDamageCovered,
        formData.frostEventCovered
      ];
      
      // Convert premium to wei
      const premiumWei = ethers.utils.parseEther(premium.toString());
      
      await ContractService.purchasePolicy(
        formData.countyId,
        formData.acres,
        formData.coveragePerAcre * 100, // Convert to cents
        formData.months,
        coveredEvents,
        premiumWei
      );
      
      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError('Failed to purchase policy: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container className="mt-5">
      <h1>Purchase Insurance Policy</h1>
      
      {error && <Alert variant="danger">{error}</Alert>}
      {success && <Alert variant="success">Policy purchased successfully!</Alert>}
      
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
              <Form.Label>Acres to Insure</Form.Label>
              <Form.Control 
                type="number" 
                name="acres" 
                value={formData.acres}
                onChange={handleChange}
                min="1"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Coverage Per Acre (USD)</Form.Label>
              <Form.Control 
                type="number" 
                name="coveragePerAcre" 
                value={formData.coveragePerAcre}
                onChange={handleChange}
                min="50"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Policy Term (Months)</Form.Label>
              <Form.Select 
                name="months" 
                value={formData.months}
                onChange={handleChange}
              >
                <option value="1">1 Month</option>
                <option value="3">3 Months</option>
                <option value="6">6 Months</option>
                <option value="12">12 Months</option>
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Covered Weather Events</Form.Label>
              <Form.Check 
                type="checkbox"
                label="Drought"
                name="droughtCovered"
                checked={formData.droughtCovered}
                onChange={handleChange}
              />
              <Form.Check 
                type="checkbox"
                label="Excessive Rain"
                name="excessiveRainCovered"
                checked={formData.excessiveRainCovered}
                onChange={handleChange}
              />
              <Form.Check 
                type="checkbox"
                label="Heat Stress"
                name="heatStressCovered"
                checked={formData.heatStressCovered}
                onChange={handleChange}
              />
              <Form.Check 
                type="checkbox"
                label="Wind Damage"
                name="windDamageCovered"
                checked={formData.windDamageCovered}
                onChange={handleChange}
              />
              <Form.Check 
                type="checkbox"
                label="Frost Events"
                name="frostEventCovered"
                checked={formData.frostEventCovered}
                onChange={handleChange}
              />
            </Form.Group>
            
            <Button 
              variant="secondary" 
              onClick={calculatePremium} 
              className="me-2"
              disabled={loading}
            >
              Calculate Premium
            </Button>
            
            {premium > 0 && (
              <div className="mt-3 mb-3">
                <h4>Estimated Premium: ${premium.toFixed(2)}</h4>
                <small>This will be converted to ETH at time of purchase</small>
              </div>
            )}
            
            <Button 
              variant="primary" 
              type="submit"
              disabled={loading || premium === 0}
            >
              {loading ? 'Processing...' : 'Purchase Policy'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default PurchasePolicy;