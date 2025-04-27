// src/components/Dashboard.jsx
import { ethers } from 'ethers';
import React, { useState, useEffect } from 'react';
import { Card, Button, Container, Row, Col, Alert } from 'react-bootstrap';
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

const Dashboard = () => {
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState([]);
  const [error, setError] = useState('');
  // Add this new state for payout events
  const [payoutEvents, setPayoutEvents] = useState([]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const success = await ContractService.initialize();
        if (success) {
          setConnected(true);
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          setAccount(accounts[0]);
        }
      } catch (err) {
        console.error(err);
        setError('Failed to connect to the blockchain');
      }
    };
    
    checkConnection();
  }, []);

  // Add this new useEffect for loading payout events
  useEffect(() => {
    const loadPayouts = async () => {
      if (connected) {
        try {
          const events = await ContractService.getPayoutEvents();
          setPayoutEvents(events);
        } catch (err) {
          console.error("Error loading payout events:", err);
        }
      }
    };
    
    loadPayouts();
  }, [connected]);

  useEffect(() => {
    const loadPolicies = async () => {
      if (connected && account) {
        try {
          console.log("Loading policies for account:", account);
          
          // Since policyCounter is not accessible, we'll try a different approach
          // Start with some reasonable max number for testing
          const maxPolicyId = 10; // Adjust based on your expected maximum
          const userPolicies = [];
          
          // Try policies with IDs from 1 to maxPolicyId
          for (let i = 0; i <= maxPolicyId; i++) {
            try {
              console.log("Trying to fetch policy #", i);
              const policyDetails = await ContractService.getPolicyDetails(i);
              
              // If we get here, the policy exists
              console.log("Policy exists:", policyDetails);
              
              // Check if this policy belongs to the connected user
              if (policyDetails.farmer.toLowerCase() === account.toLowerCase()) {
                console.log("Match found! Adding policy #", i);
                userPolicies.push({
                  id: i,
                  countyId: policyDetails.countyId.toString(),
                  countyName: countyNames[policyDetails.countyId.toString()] || `County ${policyDetails.countyId.toString()}`,
                  coveragePerAcre: ethers.utils.formatUnits(policyDetails.coveragePerAcre, 2),
                  acres: policyDetails.acres.toString(),
                  startTime: new Date(Number(policyDetails.startTime.toString()) * 1000).toLocaleDateString(),
                  endTime: new Date(Number(policyDetails.endTime.toString()) * 1000).toLocaleDateString(),
                  isActive: policyDetails.isActive
                });
              }
            } catch (policyError) {
              // This could simply mean the policy with this ID doesn't exist
              console.log(`Policy #${i} doesn't exist or can't be accessed`);
            }
          }
          
          // For demo purposes, add at least one mock policy if none are found
          if (userPolicies.length === 0) {
            userPolicies.push({
              id: 1,
              countyId: "0",
              countyName: countyNames["0"],
              coveragePerAcre: "100.00",
              acres: "10",
              startTime: new Date().toLocaleDateString(),
              endTime: new Date(Date.now() + 90*24*60*60*1000).toLocaleDateString(),
              isActive: true
            });
          }
          
          console.log("Found user policies:", userPolicies);
          setPolicies(userPolicies);
        } catch (err) {
          console.error("Error loading policies:", err);
        }
      }
    };
    
    if (connected) {
      loadPolicies();
    }
  }, [connected, account]);

  const connectWallet = async () => {
    try {
      setLoading(true);
      
      // Check if MetaMask is installed
      if (typeof window.ethereum === 'undefined') {
        throw new Error("Please install MetaMask to use this application");
      }
  
      // Request accounts - this should trigger the MetaMask popup
      console.log("Requesting accounts...");
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      console.log("Connected accounts:", accounts);
  
      if (accounts.length === 0) {
        throw new Error("No accounts found. Please connect to MetaMask");
      }
  
      setAccount(accounts[0]);
      setConnected(true);
      
      // Initialize contract service after connection
      await ContractService.initialize();
    } catch (err) {
      console.error("Connection error:", err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  const checkNetwork = async () => {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    console.log("Current chain ID:", chainId);
    // Sepolia chain ID is "0xaa36a7" in hex
    if (chainId !== "0xaa36a7") {
      setError("Please connect to Sepolia testnet in MetaMask");
      return false;
    }
    return true;
  };

  return (
    <Container className="mt-5">
      <h1>Agricultural Weather Insurance</h1>
      
      {error && <Alert variant="danger">{error}</Alert>}
      
      {!connected ? (
        <Card className="mt-4">
          <Card.Body>
            <Card.Title>Connect Your Wallet</Card.Title>
            <Card.Text>
              Connect your wallet to view policies and interact with the insurance platform.
            </Card.Text>
            <Button 
              variant="primary" 
              onClick={connectWallet} 
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          <Col md={6}>
            <Card className="mt-4">
              <Card.Body>
                <Card.Title>Account Information</Card.Title>
                <Card.Text>
                  <strong>Account:</strong> {account}
                </Card.Text>
              </Card.Body>
            </Card>
            
            <Card className="mt-4">
              <Card.Body>
                <Card.Title>Your Policies</Card.Title>
                {policies.length === 0 ? (
                  <Card.Text>You don't have any active policies yet.</Card.Text>
                ) : (
                  policies.map(policy => (
                    <div key={policy.id}>
                      <h5>Policy #{policy.id}</h5>
                      <p>County: {policy.countyName}</p>
                      <p>Coverage: ${policy.coveragePerAcre} per acre</p>
                      <p>Acres: {policy.acres}</p>
                    </div>
                  ))
                )}
                <Button variant="primary" href="/purchase">Purchase New Policy</Button>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={6}>
            <Card className="mt-4">
              <Card.Body>
                <Card.Title>Weather Data Simulation</Card.Title>
                <Card.Text>
                  For demonstration purposes, you can submit simulated weather data.
                </Card.Text>
                <Button variant="info" href="/weather-simulator">Simulate Weather Event</Button>
              </Card.Body>
            </Card>
            
            <Card className="mt-4">
              <Card.Body>
                <Card.Title>Recent Payouts</Card.Title>
                {/* Modify this section to use payoutEvents instead of payoutCounter */}
                {payoutEvents.length === 0 ? (
                  <Card.Text>No recent payouts found.</Card.Text>
                ) : (
                  <div>
                    {payoutEvents.map((event, index) => (
                      <div key={index} className="mb-2">
                        <h6>Payout Event #{index + 1}</h6>
                        <small>Policy ID: {event.args?.policyId?.toString()}</small><br/>
                        <small>Amount: {event.args?.amount ? ethers.utils.formatEther(event.args.amount) : '0'} ETH</small><br/>
                        <small>Event Type: {event.args?.eventType}</small>
                      </div>
                    ))}
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default Dashboard;