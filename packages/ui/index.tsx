import * as React from 'react';
import { getStatusBadgeStyles } from '@kongila/utils';
import { Mascot } from './mascot';

export interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', onClick, style }) => {
  return (
    <div 
      className={`glass-card ${className}`} 
      onClick={onClick}
      style={{
        background: 'var(--bg-secondary, #FFFFFF)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--border-glass, #DDE2EC)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0px 1px 3px rgba(0,0,0,0.02), 0px 8px 24px rgba(0,0,0,0.04)',
        transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s ease, box-shadow 0.2s ease',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
    >
      {children}
    </div>
  );
};

export interface BadgeProps {
  text: string;
  status?: string;
}

export const Badge: React.FC<BadgeProps> = ({ text, status }) => {
  const styles = getStatusBadgeStyles(status || text);
  return (
    <span
      className="badge-tag"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: '20px',
        fontSize: '12px',
        fontWeight: 600,
        backgroundColor: styles.bg,
        color: styles.color,
        border: `1px solid ${styles.color}22`,
        textShadow: 'none',
        boxShadow: 'none',
        letterSpacing: '0.5px'
      }}
    >
      {text}
    </span>
  );
};

export interface ChipProps {
  label: string;
}

export const Chip: React.FC<ChipProps> = ({ label }) => {
  const styles = getStatusBadgeStyles(label);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, background: styles.bg, color: styles.color, whiteSpace: 'nowrap', border: `1px solid ${styles.color}22` }}>
      {label}
    </span>
  );
};

export interface NeonButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  style?: React.CSSProperties;
  type?: 'button' | 'submit' | 'reset';
}

export const NeonButton: React.FC<NeonButtonProps> = ({ 
  children, onClick, variant = 'primary', disabled = false, style, type = 'button' 
}) => {
  const getColors = () => {
    switch (variant) {
      case 'secondary':
        return {
          bg: 'var(--bg-secondary, #FFFFFF)',
          border: 'var(--border-glass, #DDE2EC)',
          hoverBg: 'var(--bg-tertiary, #F5F7FA)',
          color: 'var(--text-primary, #1A2340)',
          shadow: 'none'
        };
      case 'danger':
        return {
          bg: 'var(--accent-magenta-glow, rgba(229, 62, 62, 0.1))',
          border: 'var(--accent-magenta, #E53E3E)',
          hoverBg: 'var(--accent-magenta, #E53E3E)',
          color: '#ffffff',
          shadow: 'none'
        };
      case 'ghost':
        return {
          bg: 'transparent',
          border: 'transparent',
          hoverBg: 'var(--bg-tertiary, #F5F7FA)',
          color: 'var(--text-secondary, #6B7A99)',
          shadow: 'none'
        };
      case 'primary':
      default:
        return {
          bg: 'var(--accent-purple, #0047CC)',
          border: 'transparent',
          hoverBg: 'var(--kongila-dark-navy, #002B7F)',
          color: '#ffffff',
          shadow: 'rgba(0, 71, 204, 0.16)'
        };
    }
  };

  const colors = getColors();

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '12px 24px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 600,
        background: colors.bg,
        border: variant === 'primary' ? 'none' : `1px solid ${colors.border}`,
        color: colors.color,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: variant === 'primary' && !disabled ? `0px 4px 12px ${colors.shadow}` : 'none',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        outline: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        ...style
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        const btn = e.currentTarget;
        if (variant === 'primary') {
          btn.style.boxShadow = `0px 6px 20px ${colors.shadow}`;
          btn.style.background = colors.hoverBg;
          btn.style.transform = 'translateY(-1px)';
        } else {
          btn.style.background = colors.hoverBg;
          btn.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.transform = 'none';
        if (variant === 'primary') {
          btn.style.boxShadow = `0px 4px 12px ${colors.shadow}`;
          btn.style.background = colors.bg as string;
        } else {
          btn.style.background = colors.bg as string;
        }
      }}
    >
      {children}
    </button>
  );
};

export interface AgentBadgeProps {
  name: string;
}

export const AgentBadge: React.FC<AgentBadgeProps> = ({ name }) => {
  const getAgentColor = () => {
    switch (name) {
      case 'Context Agent': return '#ff007f'; // deep pink
      case 'Workflow Agent': return '#00ffcc'; // neon teal
      case 'Matching Agent': return '#33ff57'; // neon green
      case 'Performance Agent': return '#ffcc00'; // neon gold
      case 'Execution Agent': return '#bf00ff'; // neon purple
      case 'Finance Agent': return '#00bfff'; // neon deep blue
      case 'Compliance Agent': return '#ffa500'; // orange
      case 'Insight Agent':
      default:
        return '#00ff00';
    }
  };

  const color = getAgentColor();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 8px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 700,
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}33`,
        letterSpacing: '0.5px',
        textTransform: 'uppercase'
      }}
    >
      <span style={{
        display: 'inline-block',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 6px ${color}`
      }} />
      {name}
    </span>
  );
};
/**
 * The loader every portal already calls.
 *
 * It used to be a pulsing blue square. Rewiring it to the mascot upgrades
 * every existing call site at once — admin, candidate and client — without
 * touching any of them, which is the only realistic way to get one loading
 * state across three portals that were each doing their own thing.
 */
export const KongilaLoader = ({ text = 'Loading...' }: { text?: string }) => (
  <MascotLoader message={text} variant="panel" />
);

/* ─── Kon, the mascot ─────────────────────────────────────────────────────
 *
 * Three components, one vocabulary. Every portal had its own idea of what
 * "waiting", "nothing here" and "that failed" look like, so a person moving
 * between their dashboard and a form met a different language each time.
 *
 *   MascotLoader   something is in flight
 *   MascotNotice   a result worth stopping on
 *   MascotEmpty    a list with nothing in it yet
 *
 * Deliberately plain to call: a component nobody can remember the props for
 * gets bypassed, and then the vocabulary drifts again.
 */

export { Mascot } from './mascot';
export type { MascotState, MascotTone, MascotProps } from './mascot';

export interface MascotLoaderProps {
  /** One short line. Say what is happening, not "Please wait". */
  message?: string;
  /** 'page' fills the viewport, 'panel' its container, 'inline' sits in a row. */
  variant?: 'page' | 'panel' | 'inline';
  size?: number;
}

export const MascotLoader: React.FC<MascotLoaderProps> = ({
  message = 'Loading',
  variant = 'panel',
  size
}) => {
  const dimension = size ?? (variant === 'inline' ? 28 : variant === 'page' ? 92 : 64);

  if (variant === 'inline') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <Mascot state="loading" size={dimension} label="" />
        <span style={{ fontSize: 13, color: 'var(--text-secondary, #6B7A99)', fontWeight: 500 }}>{message}</span>
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: variant === 'page' ? '100vh' : '50vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 32,
        textAlign: 'center'
      }}
    >
      <Mascot state="loading" size={dimension} label="" />
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary, #526180)' }}>{message}</div>
    </div>
  );
};

export interface MascotNoticeProps {
  state: 'matched' | 'happy' | 'congratulations' | 'sad' | 'failed';
  title: string;
  /** One or two sentences. If there is nothing to add, leave it out. */
  detail?: string;
  action?: React.ReactNode;
  compact?: boolean;
}

export const MascotNotice: React.FC<MascotNoticeProps> = ({
  state,
  title,
  detail,
  action,
  compact
}) => {
  const critical = state === 'failed';
  return (
    <div
      role={critical ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: compact ? '14px 16px' : '22px 24px',
        borderRadius: 14,
        background: critical ? '#FEF2F2' : '#F4F8FF',
        border: '1px solid ' + (critical ? '#FBD5D3' : '#D7E4FB')
      }}
    >
      <Mascot state={state} size={compact ? 40 : 56} label="" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compact ? 14 : 15.5, fontWeight: 600, color: '#0E1726', letterSpacing: '-0.01em' }}>
          {title}
        </div>
        {detail && (
          <p style={{ margin: '5px 0 0', fontSize: 13.5, lineHeight: 1.6, color: '#526180' }}>{detail}</p>
        )}
        {action && <div style={{ marginTop: 14 }}>{action}</div>}
      </div>
    </div>
  );
};

export interface MascotEmptyProps {
  title: string;
  /** Say what would put something here, not merely that it is empty. */
  detail?: string;
  action?: React.ReactNode;
  size?: number;
}

export const MascotEmpty: React.FC<MascotEmptyProps> = ({ title, detail, action, size = 72 }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 14,
      padding: '48px 24px',
      textAlign: 'center'
    }}
  >
    <Mascot state="empty" size={size} label="" />
    <div style={{ fontSize: 15, fontWeight: 600, color: '#0E1726', letterSpacing: '-0.01em' }}>{title}</div>
    {detail && (
      <p style={{ margin: 0, maxWidth: 380, fontSize: 13.5, lineHeight: 1.62, color: '#6B7A99' }}>{detail}</p>
    )}
    {action && <div style={{ marginTop: 6 }}>{action}</div>}
  </div>
);

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = React.createContext<ToastContextType>({ addToast: () => {} });

export const ToastProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '12px', zIndex: 99999, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.type === 'error' ? '#FEF2F2' : t.type === 'success' ? '#ECFDF5' : '#EFF6FF',
            border: `1px solid ${t.type === 'error' ? '#FCA5A5' : t.type === 'success' ? '#6EE7B7' : '#93C5FD'}`,
            color: t.type === 'error' ? '#B91C1C' : t.type === 'success' ? '#047857' : '#1D4ED8',
            padding: '16px 24px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            animation: 'kongilaToastSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            pointerEvents: 'auto'
          }}>
            <span style={{ fontSize: '20px' }}>
              {t.type === 'error' ? '❌' : t.type === 'success' ? '✅' : 'ℹ️'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes kongilaToastSlideIn {
          from { transform: translateX(120%) scale(0.9); opacity: 0; }
          to { transform: translateX(0) scale(1); opacity: 1; }
        }
      `}} />
    </ToastContext.Provider>
  );
}

export const useToast = () => React.useContext(ToastContext);
