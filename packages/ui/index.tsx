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
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s ease, box-shadow 0.3s ease',
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
        textShadow: `0 0 8px ${styles.color}33`,
        boxShadow: `0 0 10px ${styles.color}11`,
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
          bg: 'rgba(255, 255, 255, 0.03)',
          border: 'rgba(255, 255, 255, 0.1)',
          hoverBg: 'rgba(255, 255, 255, 0.08)',
          color: '#ffffff',
          shadow: 'none'
        };
      case 'danger':
        return {
          bg: 'rgba(255, 51, 51, 0.1)',
          border: '#ff3333',
          hoverBg: '#ff3333',
          color: '#ffffff',
          shadow: 'rgba(255, 51, 51, 0.4)'
        };
      case 'ghost':
        return {
          bg: 'transparent',
          border: 'transparent',
          hoverBg: 'rgba(255, 255, 255, 0.05)',
          color: '#aaaaaa',
          shadow: 'none'
        };
      case 'primary':
      default:
        return {
          bg: 'linear-gradient(135deg, #00ffcc, #33ff57)',
          border: 'transparent',
          hoverBg: 'linear-gradient(135deg, #00e6b8, #2ee64e)',
          color: '#050c14',
          shadow: 'rgba(0, 255, 204, 0.4)'
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
        boxShadow: variant === 'primary' && !disabled ? `0 0 15px ${colors.shadow}` : 'none',
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
          btn.style.boxShadow = `0 0 25px ${colors.shadow}`;
          btn.style.transform = 'translateY(-2px)';
        } else {
          btn.style.background = colors.hoverBg;
          btn.style.transform = 'translateY(-1px)';
        }
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget;
        btn.style.transform = 'none';
        if (variant === 'primary') {
          btn.style.boxShadow = `0 0 15px ${colors.shadow}`;
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
