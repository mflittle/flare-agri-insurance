// src/services/ContractService.js
import { ethers } from 'ethers';
import ABI from '../contracts/AgriculturalWeatherInsurance.json';

//const CONTRACT_ADDRESS = '0x064540b6DC0962853B219b4F4655FC0820527fDE';
const CONTRACT_ADDRESS = '0xCdB810eD073e2B40aB6141f45F7C1680E335f3DA';


class ContractService {
  constructor() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    this.initialized = false;
  }

  async initialize() {
    if (window.ethereum) {
      this.provider = new ethers.providers.Web3Provider(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      this.signer = this.provider.getSigner();
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, this.signer);
      this.initialized = true;
      return true;
    }
    return false;
  }

  async getPayoutEvents() {
    if (!this.initialized) await this.initialize();
    // Use events instead of direct counter reading
    const filter = this.contract.filters.PolicyPayout();
    const events = await this.contract.queryFilter(filter);
    return events;
  }

  async getCountyData(countyId) {
    if (!this.initialized) await this.initialize();
    const active = await this.contract.counties(countyId);
    return { active };
  }

  async getPolicyDetails(policyId) {
    if (!this.initialized) await this.initialize();
    return await this.contract.getPolicyDetails(policyId);
  }

  async purchasePolicy(countyId, acres, coveragePerAcre, months, coveredEvents, premium) {
    if (!this.initialized) await this.initialize();
    const tx = await this.contract.purchasePolicy(
      countyId, acres, coveragePerAcre, months, coveredEvents,
      { value: premium }
    );
    return await tx.wait();
  }

  async submitTestWeatherData(countyId, eventType, measurement) {
    if (!this.initialized) await this.initialize();
    const tx = await this.contract.testSubmitWeatherData(
      countyId, 
      eventType, 
      measurement,
      { gasLimit: 500000 } // Add manual gas limit
    );
    return await tx.wait();
  }
}

export default new ContractService();