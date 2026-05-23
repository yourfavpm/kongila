import * as React from 'react';
import { getStatusBadgeStyles } from '@kongila/utils';

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
