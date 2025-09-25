"use client"; // This is a directive for Next.js to run this component on the client

import { useState } from 'react';

// Main App Component
export default function TradeJournalPage() {
    // --- STATE MANAGEMENT with useState ---
    const [positions, setPositions] = useState([
        { ticker: 'AAPL', shares: 50, avgCost: 150.25, currentPrice: 175.50 },
        { ticker: 'GOOGL', shares: 10, avgCost: 2800.00, currentPrice: 2850.75 },
        { ticker: 'TSLA', shares: 25, avgCost: 800.50, currentPrice: 750.80 },
        { ticker: 'BTC', shares: 0.5, avgCost: 40000.00, currentPrice: 42500.00 },
        { ticker: 'ETH', shares: 10, avgCost: 2500.00, currentPrice: 3100.00 },
    ]);

    const [journalEntries, setJournalEntries] = useState([
        { id: 1, ticker: 'AAPL', date: '2023-10-15', content: 'Bought on earnings dip. Strong fundamentals and new product cycle should drive growth.' },
        { id: 2, ticker: 'TSLA', date: '2023-11-01', content: 'Technical breakout above the 50-day moving average. High risk, high reward play on EV adoption.' },
        { id: 3, ticker: 'ETH', date: '2023-11-05', content: 'Adding to my long-term ETH position ahead of the upcoming network upgrade. Bullish on staking rewards.' },
        { id: 4, ticker: 'TSLA', date: '2023-11-20', content: 'Volatility is high. Considering trimming position if it breaks below $700 support.'},
    ]);

    const [currentPage, setCurrentPage] = useState('performance');
    const [selectedJournalAsset, setSelectedJournalAsset] = useState(null);
    
    // Modal States
    const [isTradeModalOpen, setTradeModalOpen] = useState(false);
    const [isJournalModalOpen, setJournalModalOpen] = useState(false);
    const [editingJournalEntry, setEditingJournalEntry] = useState(null);

    // --- HELPER FUNCTIONS ---
    const formatCurrency = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

    const handleTradeFormSubmit = (e) => {
        e.preventDefault();
        const ticker = e.target.ticker.value.toUpperCase();
        const shares = parseFloat(e.target.shares.value);
        const price = parseFloat(e.target.price.value);

        setPositions(prevPositions => {
            const newPositions = [...prevPositions];
            const existingPosition = newPositions.find(p => p.ticker === ticker);
            if (existingPosition) {
                const totalCost = (existingPosition.avgCost * existingPosition.shares) + (price * shares);
                existingPosition.shares += shares;
                existingPosition.avgCost = totalCost / existingPosition.shares;
            } else {
                newPositions.push({ ticker, shares, avgCost: price, currentPrice: price });
            }
            return newPositions;
        });
        
        setTradeModalOpen(false);
    };
    
    const handleJournalFormSubmit = (e) => {
        e.preventDefault();
        const content = e.target['journal-content'].value;

        if (editingJournalEntry) {
             setJournalEntries(prev => prev.map(entry => 
                entry.id === editingJournalEntry.id ? { ...entry, content } : entry
            ));
        } else {
            const newEntry = {
                id: Date.now(),
                ticker: selectedJournalAsset,
                date: new Date().toISOString().split('T')[0],
                content: content,
            };
            setJournalEntries(prev => [...prev, newEntry]);
        }
        
        setJournalModalOpen(false);
        setEditingJournalEntry(null);
    };

    const handleDeleteJournalEntry = (entryIdToDelete) => {
         if (confirm('Are you sure you want to delete this journal entry?')) {
            setJournalEntries(prev => prev.filter(je => je.id !== entryIdToDelete));
        }
    };
    
    // --- UI SUB-COMPONENTS ---

    const PerformancePage = () => (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Positions</h1>
            </div>
            <div className="bg-gray-800/50 rounded-lg shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/60 text-xs text-gray-400 uppercase tracking-wider">
                            <tr>
                                <th className="p-4">Symbol</th>
                                <th className="p-4 text-right">Shares</th>
                                <th className="p-4 text-right">Avg. Cost</th>
                                <th className="p-4 text-right">Current Price</th>
                                <th className="p-4 text-right">Market Value</th>
                                <th className="p-4 text-right">Total G/L</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {positions.map(pos => {
                                const marketValue = pos.shares * pos.currentPrice;
                                const totalCost = pos.shares * pos.avgCost;
                                const gainLoss = marketValue - totalCost;
                                const gainLossPercent = totalCost === 0 ? 0 : (gainLoss / totalCost) * 100;
                                const isGain = gainLoss >= 0;
                                return (
                                    <tr key={pos.ticker} className="hover:bg-gray-800">
                                        <td className="p-4 font-bold text-white">{pos.ticker}</td>
                                        <td className="p-4 text-right">{pos.shares.toLocaleString()}</td>
                                        <td className="p-4 text-right">{formatCurrency(pos.avgCost)}</td>
                                        <td className="p-4 text-right">{formatCurrency(pos.currentPrice)}</td>
                                        <td className="p-4 text-right">{formatCurrency(marketValue)}</td>
                                        <td className={`p-4 text-right font-semibold ${isGain ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatCurrency(gainLoss)} ({gainLossPercent.toFixed(2)}%)
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const JournalPage = () => {
        const uniqueAssets = [...new Set(positions.map(p => p.ticker))];
        const entriesForAsset = journalEntries
            .filter(entry => entry.ticker === selectedJournalAsset)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        return (
            <div>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-white">Journal</h1>
                </div>
                <div className="mb-8">
                    <h2 className="text-xl font-semibold mb-4 text-gray-300">Select an Asset to Journal</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                        {uniqueAssets.map(ticker => (
                            <button 
                                key={ticker} 
                                onClick={() => setSelectedJournalAsset(ticker)}
                                className={`p-3 rounded-lg text-center font-semibold transition-colors ${selectedJournalAsset === ticker ? 'bg-emerald-500 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                            >
                                {ticker}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="bg-gray-800/50 rounded-lg shadow-lg p-6">
                    {!selectedJournalAsset ? (
                        <p className="text-center text-gray-400">Select an asset from the grid above to view its journal entries.</p>
                    ) : (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-white">Entries for {selectedJournalAsset}</h3>
                                <button onClick={() => { setEditingJournalEntry(null); setJournalModalOpen(true); }} className="text-sm bg-emerald-500 text-white font-semibold py-1 px-3 rounded-md hover:bg-emerald-600 transition-colors">
                                    Add Entry
                                </button>
                            </div>
                            <div className="space-y-4">
                                {entriesForAsset.length > 0 ? entriesForAsset.map(entry => (
                                    <div key={entry.id} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
                                        <div className="flex justify-between items-baseline mb-2">
                                            <p className="font-semibold text-gray-300">{new Date(entry.date).toLocaleDateString()}</p>
                                            <div>
                                                <button onClick={() => { setEditingJournalEntry(entry); setJournalModalOpen(true); }} className="edit-journal-btn text-xs text-gray-400 hover:text-white">Edit</button>
                                                <button onClick={() => handleDeleteJournalEntry(entry.id)} className="delete-journal-btn text-xs text-red-400 hover:text-red-300 ml-2">Delete</button>
                                            </div>
                                        </div>
                                        <p className="text-gray-300 whitespace-pre-wrap">{entry.content}</p>
                                    </div>
                                )) : <p className="text-center text-gray-400 py-4">No journal entries for {selectedJournalAsset} yet.</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const TradeModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-white">Add New Trade</h2>
                <form onSubmit={handleTradeFormSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="ticker" className="block text-sm font-medium text-gray-400">Ticker</label>
                            <input type="text" id="ticker" name="ticker" className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-white" placeholder="e.g., AAPL" required />
                        </div>
                        <div>
                            <label htmlFor="shares" className="block text-sm font-medium text-gray-400">Shares</label>
                            <input type="number" id="shares" name="shares" step="any" className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-white" placeholder="e.g., 10" required />
                        </div>
                        <div>
                            <label htmlFor="price" className="block text-sm font-medium text-gray-400">Price per Share</label>
                            <input type="number" id="price" name="price" step="any" className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-white" placeholder="e.g., 175.50" required />
                        </div>
                    </div>
                    <div className="mt-8 flex justify-end space-x-3">
                        <button type="button" onClick={() => setTradeModalOpen(false)} className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
                        <button type="submit" className="bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-emerald-600 transition-colors">Save Trade</button>
                    </div>
                </form>
            </div>
        </div>
    );
    
    const JournalModal = () => (
         <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-6 text-white">{editingJournalEntry ? `Edit Entry for ${selectedJournalAsset}` : `Add Entry for ${selectedJournalAsset}`}</h2>
                <form onSubmit={handleJournalFormSubmit}>
                    <div>
                        <label htmlFor="journal-content" className="block text-sm font-medium text-gray-400">Journal Note</label>
                        <textarea id="journal-content" name="journal-content" rows="6" defaultValue={editingJournalEntry?.content || ''} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 text-white" placeholder="Why did you make this trade? What's your thesis?" required></textarea>
                    </div>
                    <div className="mt-8 flex justify-end space-x-3">
                        <button type="button" onClick={() => { setJournalModalOpen(false); setEditingJournalEntry(null); }} className="bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">Cancel</button>
                        <button type="submit" className="bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-emerald-600 transition-colors">Save Entry</button>
                    </div>
                </form>
            </div>
        </div>
    );

    // Main component render
    return (
        <div className="bg-gray-900 text-gray-200 antialiased font-sans">
            <div className="flex flex-col min-h-screen">
                <header className="bg-gray-900 border-b border-gray-700/50 p-4 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center space-x-8">
                        <div className="flex items-center space-x-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400"><path d="M3 3v18h18"></path><path d="m19 9-5 5-4-4-3 3"></path></svg>
                            <h1 className="text-xl font-bold">TradeLog</h1>
                        </div>
                        <nav className="flex items-center space-x-2">
                            <button onClick={() => setCurrentPage('performance')} className={`font-medium px-4 py-2 rounded-md text-sm transition-colors ${currentPage === 'performance' ? 'text-white bg-gray-800' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                                Performance
                            </button>
                            <button onClick={() => setCurrentPage('journal')} className={`font-medium px-4 py-2 rounded-md text-sm transition-colors ${currentPage === 'journal' ? 'text-white bg-gray-800' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                                Journal
                            </button>
                        </nav>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={() => setTradeModalOpen(true)} className="bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-emerald-600 transition-colors text-sm">
                            Add Trade
                        </button>
                        <img src="https://placehold.co/40x40/1f2937/a7f3d0?text=U" alt="User Avatar" className="w-10 h-10 rounded-full" />
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {currentPage === 'performance' ? <PerformancePage /> : <JournalPage />}
                </main>
            </div>
            
            {isTradeModalOpen && <TradeModal />}
            {isJournalModalOpen && <JournalModal />}
        </div>
    );
}

