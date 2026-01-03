import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Chart } from './components/Chart';
import { PieChart } from './components/PieChart';
import { Holdings } from './components/Holdings';
import { AlertSystem } from './components/AlertSystem';
import { DemurrageAlert } from './components/DemurrageAlert';
import { WalletSummary } from './components/WalletSummary';
import { Collectibles } from './components/Collectibles';
import type { Alert, Holding, DemurrageBox, Collectible } from './types';

// Mock data
const mockHoldings: Holding[] = [
  { 
    token: 'ERG',
    amount: 100,
    valueInErg: 100,
    change24h: 5.2,
    category: 'ERG',
    beginningBalance: 95,
    additions: 10,
    reductions: 5,
    endingBalance: 100
  },
  { 
    token: 'SigUSD',
    amount: 500,
    valueInErg: 50,
    change24h: -1.3,
    category: 'Stables',
    beginningBalance: 450,
    additions: 100,
    reductions: 50,
    endingBalance: 500
  },
  { 
    token: 'SigRSV',
    amount: 1000,
    valueInErg: 15,
    change24h: 2.8,
    category: 'Stables',
    beginningBalance: 800,
    additions: 300,
    reductions: 100,
    endingBalance: 1000
  },
  { 
    token: 'GluonGold',
    amount: 0,
    valueInErg: 0,
    change24h: -100,
    category: 'Stables',
    beginningBalance: 100,
    additions: 0,
    reductions: 100,
    endingBalance: 0
  },
  { 
    token: 'DexyGold',
    amount: 100,
    valueInErg: 10,
    change24h: 100,
    category: 'Stables',
    beginningBalance: 50,
    additions: 50,
    reductions: 0,
    endingBalance: 100
  },
  { 
    token: 'Ergopad',
    amount: 10000,
    valueInErg: 25,
    change24h: -0.5,
    category: 'Tokens',
    beginningBalance: 9000,
    additions: 2000,
    reductions: 1000,
    endingBalance: 10000
  },
  { 
    token: 'ERG/SigUSD LP',
    amount: 200,
    valueInErg: 75,
    change24h: 1.2,
    category: 'Liquidity/Lending',
    beginningBalance: 180,
    additions: 30,
    reductions: 10,
    endingBalance: 200
  }
];

const mockDemurrageBoxes: DemurrageBox[] = [
  {
    boxId: '001abc...def789',
    currentAge: 50000,
    demurrageDate: new Date('2024-08-15'),
    valueInErg: 100,
  },
  {
    boxId: '002xyz...pqr456',
    currentAge: 45000,
    demurrageDate: new Date('2024-09-01'),
    valueInErg: 75,
  },
  {
    boxId: '003mno...ijk321',
    currentAge: 48000,
    demurrageDate: new Date('2024-07-30'),
    valueInErg: 150,
  },
];

const mockChartData = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  values: [1000, 1200, 1100, 1400, 1300, 1500],
};

const mockPieData = {
  labels: ['ERG', 'Stables', 'Tokens', 'LP Tokens'],
  values: [100, 75, 25, 75],
};

const mockCollectibles: Collectible[] = [
  {
    id: '1',
    name: 'Ergo Samurai #42',
    imageUrl: 'https://images.unsplash.com/photo-1557595071-0f23cd52b7b3?w=800',
    description: 'A noble Ergo warrior',
    type: 'NFT',
    isNSFW: false,
    metadata: {
      artist: 'ErgoArtist',
      collection: 'Ergo Samurai',
      tokenId: '42'
    }
  },
  {
    id: '2',
    name: 'Ergo Symphony #1',
    imageUrl: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=800',
    description: 'First ever music NFT on Ergo',
    type: 'Audio',
    isNSFW: false,
    metadata: {
      artist: 'ErgoMusician',
      collection: 'Ergo Symphony',
      tokenId: '1',
      duration: '3:45'
    }
  },
  {
    id: '3',
    name: 'Ergo Motion',
    imageUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=800',
    description: 'Dynamic Ergo-themed video art',
    type: 'Video',
    isNSFW: false,
    metadata: {
      artist: 'MotionArtist',
      collection: 'Ergo in Motion',
      tokenId: '15',
      duration: '2:30'
    }
  },
  {
    id: '4',
    name: 'Cyber Punk Ergo',
    imageUrl: 'https://images.unsplash.com/photo-1558865869-c93f6f8482af?w=800',
    description: 'Cyberpunk themed Ergo art',
    type: 'Artwork Collection',
    isNSFW: true,
    metadata: {
      artist: 'CyberArtist',
      collection: 'Cyber Ergo',
      tokenId: '7',
      medium: 'Digital Painting'
    }
  }
];

function App() {
  const [isOnline, setIsOnline] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    // Simulate network status changes
    const interval = setInterval(() => {
      setIsOnline(Math.random() > 0.1);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleDateRangeChange = (start: Date, end: Date) => {
    console.log('Date range changed:', { start, end });
  };

  const handleDismissAlert = (id: string) => {
    setAlerts(alerts.filter(alert => alert.id !== id));
  };

  const toggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  return (
    <div className="min-h-screen bg-gray-800 text-white p-6">
      <Header
        address="9f4QF8AD1nQ3nJahQVkMj8hFSVVzVom77b52JU7EW71Zexg6N8"
        isOnline={isOnline}
        onDateRangeChange={handleDateRangeChange}
      />
      
      <div className="grid md:grid-cols-[60%_40%] gap-4 mb-6">
        <Chart data={mockChartData} />
        <PieChart data={mockPieData} />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-[60%_40%] gap-4 mb-6">
        <WalletSummary holdings={mockHoldings} />
        <DemurrageAlert boxes={mockDemurrageBoxes} />
      </div>
      
      <Holdings
        holdings={mockHoldings}
      />
      
      <Collectibles
        collectibles={mockCollectibles}
      />
      
      <AlertSystem
        alerts={alerts}
        onDismiss={handleDismissAlert}
        onToggleNotifications={toggleNotifications}
        notificationsEnabled={notificationsEnabled}
      />
    </div>
  );
}

export default App