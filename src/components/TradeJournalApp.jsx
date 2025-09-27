"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import toast, { Toaster } from 'react-hot-toast';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';

const TiptapEditor = dynamic(() => import('./TiptapEditor'), { ssr: false });

export default function TradeJournalApp({ session }) {
    const [trades, setTrades] = useState([]);
    const [positions, setPositions] = useState([]);
    const [journalEntries, setJournalEntries] = useState([]);
    const [currentPage, setCurrentPage] = useState('journal');
    const [selectedJournalAsset, setSelectedJournalAsset] = useState(null);
    const [isTradeModalOpen, setTradeModalOpen] = useState(false);
    const [isJournalModalOpen, setJournalModalOpen] = useState(false);
    const [editingJournalEntry, setEditingJournalEntry] = useState(null);
    const [viewingJournalEntry, setViewingJournalEntry] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState([]);
    const [ytdPL, setYtdPL] = useState(0);
    const [journalContent, setJournalContent] = useState('');
    const [journalDisplayCount, setJournalDisplayCount] = useState(5);
    const [selectedTickerForNewEntry, setSelectedTickerForNewEntry] = useState('');

    const formatCurrency = (num) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);

    const calculateMetrics = useCallback((trades) => {
        const tradesThisYear = trades.filter(t => new Date(t.created_at).getFullYear() === new Date().getFullYear());

        // --- Realized P/L Calculation (per TT library) ---
        let totalRealizedPL = 0;
        const tickers = [...new Set(tradesThisYear.map(t => t.ticker))];

        for (const ticker of tickers) {
            const tickerTrades = tradesThisYear.filter(t => t.ticker === ticker);
            
            const buyTrades = tickerTrades.filter(t => t.trade_type === 'BUY');
            const sellTrades = tickerTrades.filter(t => t.trade_type === 'SELL');

            if (buyTrades.length > 0 && sellTrades.length > 0) {
                const buyQty = buyTrades.reduce((sum, t) => sum + t.shares, 0);
                const sellQty = sellTrades.reduce((sum, t) => sum + t.shares, 0);

                const totalBuyValue = buyTrades.reduce((sum, t) => sum + (t.shares * t.price), 0);
                const totalSellValue = sellTrades.reduce((sum, t) => sum + (t.shares * t.price), 0);

                const avgBuyPrice = totalBuyValue / buyQty;
                const avgSellPrice = totalSellValue / sellQty;

                const matchedQty = Math.min(buyQty, sellQty);

                totalRealizedPL += (avgSellPrice - avgBuyPrice) * matchedQty;
            }
        }


        // --- Open Positions Calculation (Weighted Average) ---
        const positionsMap = {};
        const tradesSorted = [...trades].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        for (const trade of tradesSorted) {
            const { ticker, shares, price, trade_type } = trade;
            if (!positionsMap[ticker]) {
                positionsMap[ticker] = { shares: 0, totalCost: 0 };
            }
            const position = positionsMap[ticker];
            if (trade_type === 'BUY') {
                position.shares += shares;
                position.totalCost += shares * price;
            } else { // SELL
                if (position.shares > 0) {
                    const avgCostBeforeSale = position.totalCost / position.shares;
                    position.shares -= shares;
                    position.totalCost -= shares * avgCostBeforeSale;
                }
            }
        }

        const finalPositions = [];
        for (const ticker in positionsMap) {
            const position = positionsMap[ticker];
            if (position.shares > 0.000001) {
                finalPositions.push({
                    ticker,
                    shares: position.shares,
                    avgCost: position.shares > 0 ? position.totalCost / position.shares : 0,
                    currentPrice: 0 // Fetched later
                });
            }
        }

        return { positions: finalPositions, ytdPL: totalRealizedPL };
    }, []);

    const fetchMarketData = async (positions) => {
        setLoading(true);
        const tickers = positions.map(p => p.ticker).join(',');
        if (!tickers) {
            setLoading(false);
            return;
        };

        const promises = positions.map(position =>
            fetch(`https://finnhub.io/api/v1/quote?symbol=${position.ticker}&token=${process.env.NEXT_PUBLIC_FINNHUB_API_KEY}`)
                .then(res => res.json())
                .then(data => ({ ...position, currentPrice: data.c }))
        );

        const updatedPositions = await Promise.all(promises);
        setPositions(updatedPositions);
        setLoading(false);
    };

    const fetchAllData = useCallback(async () => {
        const { data: tradesData, error: tradesError } = await supabase
            .from('trades')
            .select('*')
            .eq('user_id', session.user.id);
        if (tradesError) console.error('Error fetching trades:', tradesError);
        else {
            setTrades(tradesData);
            const { positions: calculatedPositions, ytdPL: calculatedYtdPL } = calculateMetrics(tradesData);
            setPositions(calculatedPositions);
            setYtdPL(calculatedYtdPL);
            fetchMarketData(calculatedPositions);
        }

        const { data: journalData, error: journalError } = await supabase
            .from('journal_entries')
            .select('*')
            .eq('user_id', session.user.id);
        if (journalError) console.error('Error fetching journal entries:', journalError);
        else setJournalEntries(journalData);
    }, [session.user.id, calculateMetrics]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    const handleTradeFormSubmit = async (e) => {
        e.preventDefault();
        const { ticker, shares, price, trade_type, date } = e.target.elements;
        const promise = supabase
            .from('trades')
            .insert([{
                ticker: ticker.value.toUpperCase(),
                shares: parseFloat(shares.value),
                price: parseFloat(price.value),
                trade_type: trade_type.value,
                user_id: session.user.id,
                created_at: new Date(date.value).toISOString(),
            }])
            .select();

        toast.promise(promise, {
            loading: 'Adding trade...',
            success: (res) => {
                const { data, error } = res;
                if (error) throw new Error(error.message);
                const newTrades = [...trades, ...data];
                setTrades(newTrades);
                const { positions: newPositions, ytdPL: newYtdPL } = calculateMetrics(newTrades);
                setPositions(newPositions);
                setYtdPL(newYtdPL);
                fetchMarketData(newPositions);
                setTradeModalOpen(false);
                return 'Trade added successfully!';
            },
            error: (err) => `Error: ${err.message}`,
        });
    };

    const handleJournalFormSubmit = async (e) => {
        e.preventDefault();
        const content = journalContent;
        const ticker = editingJournalEntry ? editingJournalEntry.ticker : selectedJournalAsset || selectedTickerForNewEntry;

        if (!ticker) {
            toast.error('Please select a ticker.');
            return;
        }

        let promise;
        if (editingJournalEntry) {
            promise = supabase
                .from('journal_entries')
                .update({ content })
                .eq('id', editingJournalEntry.id)
                .select();
        } else {
            promise = supabase
                .from('journal_entries')
                .insert([{ ticker, content, user_id: session.user.id }])
                .select();
        }

        toast.promise(promise, {
            loading: editingJournalEntry ? 'Updating entry...' : 'Adding entry...',
            success: (res) => {
                const { data, error } = res;
                if (error) throw new Error(error.message);
                if (editingJournalEntry) {
                    setJournalEntries(prev => prev.map(entry => entry.id === editingJournalEntry.id ? data[0] : entry));
                } else {
                    setJournalEntries(prev => [...prev, ...data]);
                }
                setJournalModalOpen(false);
                setEditingJournalEntry(null);
                setJournalContent('');
                return `Journal entry ${editingJournalEntry ? 'updated' : 'added'} successfully!`;
            },
            error: (err) => `Error: ${err.message}`,
        });
    };

    const handleDeleteJournalEntry = async (entryIdToDelete) => {
        if (confirm('Are you sure you want to delete this journal entry?')) {
            const promise = supabase.from('journal_entries').delete().eq('id', entryIdToDelete);
            toast.promise(promise, {
                loading: 'Deleting entry...',
                success: () => {
                    setJournalEntries(prev => prev.filter(je => je.id !== entryIdToDelete));
                    return 'Journal entry deleted.';
                },
                error: (err) => `Error: ${err.message}`,
            });
        }
    };

    const handleRowClick = (ticker) => {
        const newExpandedRows = expandedRows.includes(ticker)
            ? expandedRows.filter(t => t !== ticker)
            : [...expandedRows, ticker];
        setExpandedRows(newExpandedRows);
    };

    const PerformancePage = () => (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">Performance</h1>
            </div>
            <YTDStats />
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Positions</h2>
                <button onClick={() => setTradeModalOpen(true)} className="bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-emerald-600 transition-colors text-sm">
                    Add Trade
                </button>
            </div>
            <PerformanceTable />
        </div>
    );

    const YTDStats = () => {
        const isGain = ytdPL >= 0;

        return (
            <div className="bg-gray-800/50 rounded-lg shadow-lg p-6 mb-6">
                <h2 className="text-xl font-bold text-white mb-4">Year-to-Date Performance</h2>
                <div className="flex justify-between items-center">
                    <span className="text-gray-400">Realized P/L</span>
                    <span className={`text-2xl font-bold ${isGain ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(ytdPL)}
                    </span>
                </div>
            </div>
        );
    };

    const TradeHistory = ({ ticker }) => {
        const tradeHistory = trades.filter(t => t.ticker === ticker);
        return (
            <td colSpan="6" className="p-4 bg-gray-700/50">
                <h4 className="text-lg font-bold text-white mb-2">Trade History for {ticker}</h4>
                <table className="w-full text-left table-fixed">
                    <thead className="bg-gray-900/60 text-xs text-gray-400 uppercase tracking-wider">
                        <tr>
                            <th className="p-2 w-1/4">Date</th>
                            <th className="p-2 w-1/4">Type</th>
                            <th className="p-2 text-right w-1/4">Shares</th>
                            <th className="p-2 text-right w-1/4">Price</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/50">
                        {tradeHistory.map(trade => (
                            <tr key={trade.id}>
                                <td className="p-2">{new Date(trade.created_at).toLocaleDateString()}</td>
                                <td className={`p-2 font-semibold ${trade.trade_type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>{trade.trade_type}</td>
                                <td className="p-2 text-right">{trade.shares}</td>
                                <td className="p-2 text-right">{formatCurrency(trade.price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </td>
        );
    };

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
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="p-4 text-center text-gray-400">Loading market data...</td>
                            </tr>
                        ) : positions.length > 0 ? positions.map(pos => {
                            const marketValue = pos.shares * pos.currentPrice;
                            const totalCost = pos.shares * pos.avgCost;
                            const gainLoss = marketValue - totalCost;
                            const gainLossPercent = totalCost === 0 ? 0 : (gainLoss / totalCost) * 100;
                            const isGain = gainLoss >= 0;
                            const isExpanded = expandedRows.includes(pos.ticker);

                            return (
                                <React.Fragment key={pos.ticker}>
                                    <tr className="hover:bg-gray-800 cursor-pointer" onClick={() => handleRowClick(pos.ticker)}>
                                        <td className="p-4 font-bold text-white">{pos.ticker}</td>
                                        <td className="p-4 text-right">{pos.shares.toLocaleString()}</td>
                                        <td className="p-4 text-right">{formatCurrency(pos.avgCost)}</td>
                                        <td className="p-4 text-right">{formatCurrency(pos.currentPrice)}</td>
                                        <td className="p-4 text-right">{formatCurrency(marketValue)}</td>
                                        <td className={`p-4 text-right font-semibold ${isGain ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatCurrency(gainLoss)} ({gainLossPercent.toFixed(2)}%)
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr>
                                            <TradeHistory ticker={pos.ticker} />
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        }) : (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-400">
                                    <div className="flex flex-col items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                        <h3 className="mt-2 text-lg font-medium text-white">No positions yet</h3>
                                        <p className="mt-1 text-sm text-gray-500">Add your first trade to get started.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    const AssetGrid = () => (
        positions.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <button 
                    onClick={() => {setSelectedJournalAsset(null); setJournalDisplayCount(5);}}
                    className={`p-4 rounded-lg text-center transition-all ${selectedJournalAsset === null ? 'bg-emerald-500 text-white shadow-lg scale-105' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                    <span className="font-bold text-lg">All</span>
                </button>
                {positions.map(pos => (
                    <button 
                        key={pos.ticker} 
                        onClick={() => {setSelectedJournalAsset(pos.ticker); setJournalDisplayCount(5);}}
                        className={`p-4 rounded-lg text-center transition-all ${selectedJournalAsset === pos.ticker ? 'bg-emerald-500 text-white shadow-lg scale-105' : 'bg-gray-800 hover:bg-gray-700'}`}
                    >
                        <span className="font-bold text-lg">{pos.ticker}</span>
                    </button>
                ))}
            </div>
        ) : (
            <div className="text-center py-8">
                <p className="text-gray-400">You have no positions to journal about. Add a trade first.</p>
            </div>
        )
    );

    const JournalSection = ({ title, entries }) => {
        const visibleEntries = entries.slice(0, journalDisplayCount);
    
        return (
            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">{title}</h2>
                    <button onClick={() => { setEditingJournalEntry(null); setJournalContent(''); setJournalModalOpen(true); }} className="bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:bg-emerald-600 transition-colors text-sm">
                        Add Entry
                    </button>
                </div>
                <div className="space-y-4">
                    {visibleEntries.map(entry => (
                        <div key={entry.id} className="bg-gray-800 p-4 rounded-lg shadow-md">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center space-x-4">
                                <p className="text-2xl font-bold text-white">{entry.ticker}</p>
                                <p className="text-2xl font-bold text-white">{new Date(entry.created_at).toLocaleDateString()}</p>
                                <button onClick={() => setViewingJournalEntry(entry)} className="text-gray-400 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                                    </svg>
                                </button>
                                <button onClick={() => { setEditingJournalEntry(entry); setJournalContent(entry.content); setJournalModalOpen(true); }} className="text-gray-400 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                    </svg>
                                </button>
                                <button onClick={() => handleDeleteJournalEntry(entry.id)} className="text-red-500 hover:text-red-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-6 h-6">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                            <div className="prose prose-invert max-w-none mt-2 max-h-96 overflow-y-auto" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(entry.content) }}></div>
                        </div>
                    ))}
                </div>
                {entries.length > journalDisplayCount && (
                    <div className="mt-4 text-center">
                        <button onClick={() => setJournalDisplayCount(prev => prev + 5)} className="text-emerald-400 hover:text-emerald-300">
                            Display More
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const JournalPage = () => {
        const sortedEntries = [...journalEntries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const entriesToShow = selectedJournalAsset 
            ? sortedEntries.filter(je => je.ticker === selectedJournalAsset) 
            : sortedEntries;

        return (
            <div>
                <h1 className="text-3xl font-bold text-white mb-6">Journal</h1>
                <AssetGrid />
                <JournalSection 
                    title={selectedJournalAsset ? `Journal: ${selectedJournalAsset}` : 'Recent Entries'}
                    entries={entriesToShow} 
                />
            </div>
        );
    };

    const ViewJournalModal = () => (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-30">
            <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white">Journal Entry for <span className="text-emerald-400">{viewingJournalEntry.ticker}</span></h2>
                    <button onClick={() => setViewingJournalEntry(null)} className="text-gray-300 hover:text-white text-2xl font-bold">&times;</button>
                </div>
                <div className="mt-4 bg-gray-900 p-4 rounded-lg max-h-[70vh] overflow-y-auto prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewingJournalEntry.content) }}>
                </div>
                 <div className="mt-8 flex justify-end">
                    <button onClick={() => setViewingJournalEntry(null)} className="py-2 px-4 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700">Close</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="bg-gray-900 text-gray-200 antialiased font-sans">
            <Toaster toastOptions={{
                style: {
                    background: '#334155',
                    color: '#fff',
                },
            }}/>
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
                    {currentPage === 'performance' ? <PerformancePage /> : <JournalPage />}
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
                                    <label htmlFor="date" className="block text-sm font-medium text-gray-300">Date</label>
                                    <input type="date" name="date" id="date" required defaultValue={new Date().toISOString().split('T')[0]} className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm" />
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
                    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl w-[70%] h-[70%] flex flex-col">
                        <h2 className="text-2xl font-bold mb-6 text-white">{editingJournalEntry ? 'Edit' : 'Add'} Journal Entry for <span className="text-emerald-400">{selectedJournalAsset || selectedTickerForNewEntry}</span></h2>
                        <form onSubmit={handleJournalFormSubmit} className="flex-grow flex flex-col gap-4 overflow-hidden">
                            {!selectedJournalAsset && !editingJournalEntry && (
                                <div>
                                    <label htmlFor="ticker-select" className="block text-sm font-medium text-gray-300">Ticker</label>
                                    <select 
                                        id="ticker-select" 
                                        value={selectedTickerForNewEntry}
                                        onChange={(e) => setSelectedTickerForNewEntry(e.target.value)}
                                        className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
                                    >
                                        <option value="">Select a ticker</option>
                                        {positions.map(p => <option key={p.ticker} value={p.ticker}>{p.ticker}</option>)}
                                    </select>
                                </div>
                            )}
                            <div className="flex-grow overflow-y-auto">
                                <TiptapEditor 
                                    content={journalContent}
                                    onChange={setJournalContent}
                                />
                            </div>
                            <div className="mt-4 flex justify-end space-x-4">
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
