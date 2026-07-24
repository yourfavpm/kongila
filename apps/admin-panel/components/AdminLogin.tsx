import React, { useState } from 'react';
import { GlassCard, NeonButton } from '@kongila/ui';
import { supabase } from '../lib/supabaseClient';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

const ADMIN_PORTAL_ROLES = new Set([
  'super_admin',
  'superadmin',
  'admin',
  'account_manager',
  'operations_manager',
  'ops_manager',
  'talent_manager',
]);

const normalizeRole = (role: any) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Check if the user has the 'admin' role — first from public.users, then from auth metadata
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (userError) {
          throw new Error('Failed to verify admin role.');
        }

        const role = normalizeRole(userData?.role || data.user.user_metadata?.role || data.user.app_metadata?.role || '');

        if (!role || !ADMIN_PORTAL_ROLES.has(role)) {
          // If user doesn't exist yet in public.users, auto-provision admin row
          if (!userData && data.user.email?.endsWith('@kongila.co')) {
            const provisionedRole = data.user.email.toLowerCase() === 'admin@kongila.co' ? 'super_admin' : 'admin';
            const { error: upsertErr } = await supabase.from('users').upsert({
              id: data.user.id,
              email: data.user.email,
              password_hash: 'auth_managed',
              role: provisionedRole,
              status: 'active',
              email_verified: true
            }, { onConflict: 'id' });
            if (!upsertErr) {
              onLoginSuccess();
              return;
            }
          }
          await supabase.auth.signOut();
          throw new Error('Access denied. You do not have admin privileges.');
        }

        onLoginSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: 'var(--bg-primary, #0B0F19)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      boxSizing: 'border-box'
    }}>
      <GlassCard style={{ maxWidth: '400px', width: '100%', padding: '40px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Admin Portal</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Sign in to access the Kongila operations dashboard.</p>
        </div>

        {errorMsg && (
          <div style={{ 
            padding: '12px', 
            borderRadius: '8px', 
            background: 'rgba(239, 68, 68, 0.1)', 
            color: '#EF4444', 
            marginBottom: '24px', 
            fontSize: '13px',
            border: '1px solid rgba(239, 68, 68, 0.3)'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                border: '1px solid var(--border-glass, rgba(255,255,255,0.1))',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder="admin@kongila.co"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: '8px',
                background: 'var(--bg-tertiary, rgba(255,255,255,0.05))',
                border: '1px solid var(--border-glass, rgba(255,255,255,0.1))',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              placeholder="••••••••"
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <NeonButton type="submit" disabled={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </NeonButton>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
