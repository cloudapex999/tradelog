"use client"; // This is a directive for Next.js to run this component on the client

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient'; // Using correct alias

// This is the main application component, shown only when logged in
export default function TradeJournalApp({ session }) {
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

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

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
    const PerformanceTable = () => (
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
    );
     // The Asset Grid for the Journal Page
    const AssetGrid = () => (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {positions.map(pos => (
                <button 
                    key={pos.ticker} 
                    onClick={() => setSelectedJournalAsset(pos.ticker)}
                    className={`p-4 rounded-lg text-center transition-all ${selectedJournalAsset === pos.ticker ? 'bg-emerald-500 text-white shadow-lg scale-105' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                    <span className="font-bold text-lg">{pos.ticker}</span>
                </button>
            ))}
        </div>
    );
    // Journal Entries for a selected asset
    const JournalSection = () => (
        <div className="mt-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white">Journal: <span className="text-emerald-400">{selectedJournalAsset}</span></h2>
                <button onClick={() => { setEditingJournalEntry(null); setJournalModalOpen(true); }} className="bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-emerald-600 transition-colors text-sm">
                    Add Entry
                </button>
            </div>
            <div className="space-y-4">
                {journalEntries.filter(je => je.ticker === selectedJournalAsset).map(entry => (
                    <div key={entry.id} className="bg-gray-800 p-4 rounded-lg shadow-md">
                        <div className="flex justify-between items-start">
                            <p className="text-gray-400 text-sm mb-2">{entry.date}</p>
                            <div className="flex space-x-2">
                                <button onClick={() => { setEditingJournalEntry(entry); setJournalModalOpen(true); }} className="text-gray-400 hover:text-white text-xs">EDIT</button>
                                <button onClick={() => handleDeleteJournalEntry(entry.id)} className="text-red-500 hover:text-red-400 text-xs">DELETE</button>
                            </div>
                        </div>
                        <p>{entry.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    
    // The main component that renders the entire page
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
                         <span className="text-sm text-gray-400">{session.user.email}</span>
                        <button onClick={handleSignOut} className="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-600 transition-colors text-sm">
                            Sign Out
                        </button>
                        <button onClick={() => setTradeModalOpen(true)} className="bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-emerald-600 transition-colors text-sm">
                            Add Trade
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {currentPage === 'performance' && (
                        <div>
                           <h1 className="text-3xl font-bold text-white mb-6">Positions</h1>
                           <PerformanceTable/>
                        </div>
                    )}
                     {currentPage === 'journal' && (
                        <div>
                           <h1 className="text-3xl font-bold text-white mb-6">Journal</h1>
                           <AssetGrid />
                           {selectedJournalAsset && <JournalSection />}
                        </div>
                    )}
                </main>
            </div>
            
            {isTradeModalOpen && (
                 <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-6 text-white">Add New Trade</h2>
                        <form onSubmit={handleTradeFormSubmit}>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="ticker" className="block text-sm font-medium text-gray-300">Ticker Symbol</label>
                                    <input type="text" name="ticker" id="ticker" required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="shares" className="block text-sm font-medium text-gray-300">Shares</label>
                                    <input type="number" step="any" name="shares" id="shares" required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="price" className="block text-sm font-medium text-gray-300">Price per Share</label>
                                    <input type="number" step="any" name="price" id="price" required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm" />
                                </div>
                            </div>
                            <div className="mt-8 flex justify-end space-x-4">
                                <button type="button" onClick={() => setTradeModalOpen(false)} className="py-2 px-4 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700">Cancel</button>
                                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-md text-sm font-medium">Add Trade</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {isJournalModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-20">
                    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-lg">
                        <h2 className="text-2xl font-bold mb-6 text-white">{editingJournalEntry ? 'Edit' : 'Add'} Journal Entry for <span className="text-emerald-400">{selectedJournalAsset}</span></h2>
                        <form onSubmit={handleJournalFormSubmit}>
                           <textarea name="journal-content" id="journal-content" rows="6" required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm" defaultValue={editingJournalEntry ? editingJournalEntry.content : ''}></textarea>
                            <div className="mt-8 flex justify-end space-x-4">
                                <button type="button" onClick={() => setJournalModalOpen(false)} className="py-2 px-4 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700">Cancel</button>
                                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-md text-sm font-medium">Save Entry</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
