"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Auth from '@/components/Auth';
import TradeJournalApp from '@/components/TradeJournalApp';

export default function Home() {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for an existing session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // Listen for changes to the authentication state
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        // Clean up the listener when the component unmounts
        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
    }

    return (
        <div>
            {!session ? <Auth /> : <TradeJournalApp key={session.user.id} session={session} />}
        </div>
    );
}