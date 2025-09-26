"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function TradeJournalApp({ session }) {
    const [trades, setTrades] = useState([]);
    const [positions, setPositions] = useState([]);
    const [journalEntries, setJournalEntries] = useState([]);
    const [currentPage, setCurrentPage] = useState('performance');
    const [selectedJournalAsset, setSelectedJournalAsset] = useState(null);
    const [isTradeModalOpen, setTradeModalOpen] = useState(false);
    const [isJournalModalOpen, setJournalModalOpen] = useState(false);
    const [editingJournalEntry, setEditingJournalEntry] = useState(null);
    const [viewingJournalEntry, setViewingJournalEntry] = useState(null);

    const formatCurrency = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

    const calculatePositions = useCallback((trades) => {
        const positionsMap = {};
        trades.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        for (const trade of trades) {
            const { ticker, shares, price, trade_type } = trade;
            if (!positionsMap[ticker]) {
                positionsMap[ticker] = { ticker, shares: 0, totalCost: 0, avgCost: 0, currentPrice: 0 };
            }
            const position = positionsMap[ticker];
            if (trade_type === 'BUY') {
                position.totalCost += shares * price;
                position.shares += shares;
                position.avgCost = position.totalCost / position.shares;
            } else {
                position.totalCost -= shares * position.avgCost;
                position.shares -= shares;
            }
        }
        return Object.values(positionsMap).filter(p => p.shares > 0);
    }, []);

    const fetchAllData = useCallback(async () => {
        const { data: tradesData, error: tradesError } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', session.user.id);
        if (tradesError) console.error('Error fetching trades:', tradesError);
        else {
            setTrades(tradesData);
            const calculatedPositions = calculatePositions(tradesData);
            setPositions(calculatedPositions);
        }

        const { data: journalData, error: journalError } = await supabase
            .from('journal_entries')
            .select('*')
            .eq('user_id', session.user.id);
        if (journalError) console.error('Error fetching journal entries:', journalError);
        else setJournalEntries(journalData);
    }, [session.user.id, calculatePositions]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleTradeFormSubmit = async (e) => {
        e.preventDefault();
        const { ticker, shares, price, trade_type } = e.target.elements;
        const { data, error } = await supabase
            .from('trades')
            .insert([{ 
                ticker: ticker.value.toUpperCase(), 
                shares: parseFloat(shares.value), 
                price: parseFloat(price.value), 
                trade_type: trade_type.value, 
                user_id: session.user.id 
            }])
            .select();

        if (error) console.error('Error adding trade:', error);
        else {
            const newTrades = [...trades, ...data];
            setTrades(newTrades);
            setPositions(calculatePositions(newTrades));
        }
        setTradeModalOpen(false);
    };

    const handleJournalFormSubmit = async (e) => {
        e.preventDefault();
        const content = e.target.elements['journal-content'].value;
        if (editingJournalEntry) {
            const { data, error } = await supabase
                .from('journal_entries')
                .update({ content })
                .eq('id', editingJournalEntry.id)
                .select();
            if (error) console.error('Error updating journal entry:', error);
            else setJournalEntries(prev => prev.map(entry => entry.id === editingJournalEntry.id ? data[0] : entry));
        } else {
            const { data, error } = await supabase
                .from('journal_entries')
                .insert([{ ticker: selectedJournalAsset, content, user_id: session.user.id }])
                .select();
            if (error) console.error('Error adding journal entry:', error);
            else setJournalEntries(prev => [...prev, ...data]);
        }
        setJournalModalOpen(false);
        setEditingJournalEntry(null);
    };

    const handleDeleteJournalEntry = async (entryIdToDelete) => {
        if (confirm('Are you sure you want to delete this journal entry?')) {
            const { error } = await supabase.from('journal_entries').delete().eq('id', entryIdToDelete);
            if (error) console.error('Error deleting journal entry:', error);
            else setJournalEntries(prev => prev.filter(je => je.id !== entryIdToDelete));
        }
    };

    const PerformancePage = () => (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Positions</h1>
                <button onClick={() => setTradeModalOpen(true)} className="bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-emerald-600 transition-colors text-sm">
                    Add Trade
                </button>
            </div>
            <PerformanceTable />
        </div>
    );

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
                            <p className="text-gray-400 text-sm mb-2">{new Date(entry.created_at).toLocaleDateString()}</p>
                            <div className="flex space-x-2">
                                <button onClick={() => setViewingJournalEntry(entry)} className="text-gray-400 hover:text-white text-xs">EXPAND</button>
                                <button onClick={() => { setEditingJournalEntry(entry); setJournalModalOpen(true); }} className="text-gray-400 hover:text-white text-xs">EDIT</button>
                                <button onClick={() => handleDeleteJournalEntry(entry.id)} className="text-red-500 hover:text-red-400 text-xs">DELETE</button>
                            </div>
                        </div>
                        <p className="whitespace-pre-wrap max-h-40 overflow-y-auto">{entry.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const ViewJournalModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-30">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Journal Entry for <span className="text-emerald-400">{viewingJournalEntry.ticker}</span></h2>
                    <button onClick={() => setViewingJournalEntry(null)} className="text-gray-300 hover:text-white text-2xl font-bold">&times;</button>
                </div>
                <div className="mt-4 bg-gray-900 p-4 rounded-lg max-h-[70vh] overflow-y-auto">
                    <p className="whitespace-pre-wrap text-gray-200">{viewingJournalEntry.content}</p>
                </div>
                 <div className="mt-8 flex justify-end">
                    <button onClick={() => setViewingJournalEntry(null)} className="py-2 px-4 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700">Close</button>
                </div>
            </div>
        </div>
    );

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
                            <button onClick={() => setCurrentPage('performance')} className={`font-medium px-4 py-2 rounded-md transition-colors ${currentPage === 'performance' ? 'text-white bg-gray-800' : 'text-gray-400 hover:bg-gray-800 hover:text-white'} text-lg`}>
                                Performance
                            </button>
                            <button onClick={() => setCurrentPage('journal')} className={`font-medium px-4 py-2 rounded-md transition-colors ${currentPage === 'journal' ? 'text-white bg-gray-800' : 'text-gray-400 hover:bg-gray-800 hover:text-white'} text-lg`}>
                                Journal
                            </button>
                        </nav>
                    </div>
                    <div className="flex items-center space-x-4">
                         <span className="text-sm text-gray-400">{session.user.email}</span>
                        <button onClick={handleSignOut} className="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-red-600 transition-colors text-sm">
                            Sign Out
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-8">
                    {currentPage === 'performance' ? <PerformancePage /> : (
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
                                    <label htmlFor="trade_type" className="block text-sm font-medium text-gray-300">Trade Type</label>
                                    <select name="trade_type" id="trade_type" required className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm">
                                        <option>BUY</option>
                                        <option>SELL</option>
                                    </select>
                                </div>
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
                                <button type="button" onClick={() => { setJournalModalOpen(false); setEditingJournalEntry(null); }} className="py-2 px-4 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700">Cancel</button>
                                <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-md text-sm font-medium">Save Entry</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {viewingJournalEntry && <ViewJournalModal />}
        </div>
    );
}
