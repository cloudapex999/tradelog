"use client";
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/lib/supabaseClient';

const Auth = () => (
  <div className="min-h-screen bg-gray-900 flex items-center justify-center">
    <div className="w-full max-w-md p-8 space-y-8 bg-gray-800 rounded-lg shadow-lg">
      <div>
        <h2 className="text-center text-3xl font-extrabold text-white">Sign in to your account</h2>
      </div>
      <SupabaseAuth
        supabaseClient={supabase}
        appearance={{ theme: ThemeSupa }}
        providers={['github']}
        theme="dark"
      />
    </div>
  </div>
);

export default Auth;