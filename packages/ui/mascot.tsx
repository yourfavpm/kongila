/**
 * Kon — the Kongila mascot.
 *
 * A profile card with a face. The card is the object this whole product is
 * about: a professional's profile, checked and verified, put in front of an
 * employer. So the mascot is the thing being matched rather than a creature
 * standing next to it, and the rounded square echoes the logo's own tile.
 *
 * An earlier version folded Kon out of the logo's angular planes. It was more
 * clever and much worse: with no eyes and no mouth you could not tell loading
 * from matched, or sad from idle, which is the only job a state mascot has.
 * Expression beats cleverness. Two eyes and a mouth carry eleven states
 * legibly at 28px, and the shape still belongs to the brand.
 *
 * States, and the moments they belong to:
 *
 *   idle             resting, blinks occasionally
 *   loading          the card rocks, three dots count underneath
 *   thinking         eyes up, thought dots — for work that takes a while
 *   matched          a second card joins, a check lands
 *   happy            a job finished
 *   congratulations  an offer, a pass, a milestone
 *   sad              nothing found, a search that came back empty-handed
 *   failed           an action that did not go through
 *   empty            a list with nothing in it yet
 *   pointing         guiding attention to something nearby
 *   lost             404
 *
 * `tone` overrides the state's own palette when a status colour is needed.
 */

import React from 'react';

/**
 * The motion, carried by the component.
 *
 * This lives in a package used by two Next apps with separate global
 * stylesheets. Shipping the keyframes as a CSS file would mean importing it
 * in both, remembering to do so in the third, and silently losing the
 * animation wherever somebody forgot. Injected once per document instead, so
 * the mascot works the moment it is imported.
 */
const MASCOT_CSS = `
.kon{line-height:0}
.kon svg{display:block;overflow:visible}
@keyframes kon-tilt{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}
@keyframes kon-dot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-6px);opacity:1}}
@keyframes kon-blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes kon-think{0%,100%{opacity:.3;transform:translateY(2px)}50%{opacity:1;transform:translateY(-2px)}}
@keyframes kon-join{0%,100%{transform:translateX(0)}50%{transform:translateX(-5px)}}
@keyframes kon-ring{0%,55%{opacity:0;transform:scale(.72)}70%{opacity:.45}100%{opacity:0;transform:scale(1.1)}}
@keyframes kon-pop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
@keyframes kon-bounce{0%,100%{transform:translateY(0)}28%{transform:translateY(-9px)}46%{transform:translateY(0)}58%{transform:translateY(-3px)}70%{transform:translateY(0)}}
@keyframes kon-confetti{0%{opacity:0;transform:translateY(10px) rotate(0)}25%{opacity:1}100%{opacity:0;transform:translateY(-26px) rotate(42deg)}}
@keyframes kon-refuse{0%,100%{transform:translateX(0)}20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-2px)}80%{transform:translateX(2px)}}
@keyframes kon-nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
@keyframes kon-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.kon--loading .kon__card{transform-origin:60px 90px;animation:kon-tilt 1.5s cubic-bezier(.22,.61,.36,1) infinite}
.kon--loading .kon__dots circle{animation:kon-dot 1.2s ease-in-out infinite}
.kon--loading .kon__dots circle:nth-child(2){animation-delay:.15s}
.kon--loading .kon__dots circle:nth-child(3){animation-delay:.3s}
.kon--idle .kon__blink,.kon--pointing .kon__blink{transform-origin:center;animation:kon-blink 5s ease-in-out infinite}
.kon--thinking .kon__think circle{animation:kon-think 1.8s ease-in-out infinite}
.kon--thinking .kon__think circle:nth-child(2){animation-delay:.3s}
.kon--matched .kon__peer{animation:kon-join 2.4s cubic-bezier(.22,.61,.36,1) infinite}
.kon--matched .kon__pulse{transform-origin:60px 60px;animation:kon-ring 2.4s cubic-bezier(.16,1,.3,1) infinite}
.kon--matched .kon__link{transform-origin:97px 98px;animation:kon-pop .5s cubic-bezier(.16,1,.3,1) .2s both}
.kon--happy .kon__card,.kon--congratulations .kon__card{animation:kon-bounce 2.2s cubic-bezier(.22,.61,.36,1) infinite}
.kon--congratulations .kon__confetti{transform-origin:60px 60px;animation:kon-confetti 2.2s cubic-bezier(.16,1,.3,1) infinite}
.kon--sad .kon__body{transform:rotate(-4deg) translateY(3px);transform-origin:60px 100px}
.kon--failed .kon__card{animation:kon-refuse .45s cubic-bezier(.22,.61,.36,1) both}
.kon--pointing .kon__arm{animation:kon-nudge 1.9s ease-in-out infinite}
.kon--lost .kon__card{animation:kon-breathe 4.4s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.kon *{animation:none !important}}
`;

const STYLE_ID = 'kongila-mascot-style';

/** Puts the keyframes in the document once, however many Kons are on screen. */
function useMascotStyles() {
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = MASCOT_CSS;
    document.head.appendChild(el);
  }, []);
}

export type MascotState =
  | 'idle'
  | 'loading'
  | 'thinking'
  | 'matched'
  | 'happy'
  | 'congratulations'
  | 'sad'
  | 'failed'
  | 'empty'
  | 'pointing'
  | 'lost';

export type MascotTone = 'brand' | 'positive' | 'caution' | 'critical' | 'neutral';

export interface MascotProps {
  state?: MascotState;
  /** Pixel width. The drawing scales from this and stays square-ish. */
  size?: number;
  /** Which way a pointing Kon faces. Ignored by every other state. */
  direction?: 'right' | 'left';
  tone?: MascotTone;
  /** Read out to screen readers. Pass '' for a decorative instance. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** [ink and header, mid, card face] per tone. */
const TONES: Record<MascotTone, [string, string, string]> = {
  brand:    ['#0047CC', '#3D7FFF', '#DCE9FF'],
  positive: ['#128A5B', '#1FB97A', '#D4F5E6'],
  caution:  ['#C98A00', '#F2B23E', '#FCEBC8'],
  critical: ['#CC3B35', '#F2706B', '#FBDEDC'],
  neutral:  ['#7B88A3', '#A8B4CB', '#E6EAF2']
};

const STATE_TONE: Record<MascotState, MascotTone> = {
  idle: 'brand',
  loading: 'brand',
  thinking: 'brand',
  matched: 'positive',
  happy: 'positive',
  congratulations: 'positive',
  sad: 'neutral',
  failed: 'critical',
  empty: 'neutral',
  pointing: 'brand',
  lost: 'neutral'
};

const DEFAULT_LABEL: Record<MascotState, string> = {
  idle: 'Kongila',
  loading: 'Loading',
  thinking: 'Working on it',
  matched: 'Matched',
  happy: 'Done',
  congratulations: 'Congratulations',
  sad: 'Nothing found',
  failed: 'Something went wrong',
  empty: 'Nothing here yet',
  pointing: 'Look here',
  lost: 'Page not found'
};

/** Eyes and mouth. Each state gets its own, so none of them collide. */
function Face({ state, ink }: { state: MascotState; ink: string }) {
  const stroke = { stroke: ink, strokeWidth: 4, fill: 'none', strokeLinecap: 'round' as const };

  const eyes = (() => {
    if (state === 'happy' || state === 'matched' || state === 'congratulations') {
      return (
        <>
          <path d="M38 55 Q44 48 50 55" {...stroke} />
          <path d="M70 55 Q76 48 82 55" {...stroke} />
        </>
      );
    }
    if (state === 'failed') {
      return (
        <>
          <path d="M40 50 L49 59 M49 50 L40 59" stroke={ink} strokeWidth={4} strokeLinecap="round" />
          <path d="M71 50 L80 59 M80 50 L71 59" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        </>
      );
    }
    if (state === 'sad') {
      return (
        <>
          <circle cx="44.5" cy="57" r="4.5" fill={ink} />
          <circle cx="75.5" cy="57" r="4.5" fill={ink} />
          <path d="M38 49 Q44.5 46 51 49" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
          <path d="M69 49 Q75.5 46 82 49" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
        </>
      );
    }
    if (state === 'thinking') {
      return (
        <>
          <circle cx="46" cy="52" r="5" fill={ink} />
          <circle cx="77" cy="52" r="5" fill={ink} />
        </>
      );
    }
    if (state === 'lost') {
      // Puzzled, not cross. Brows slanting inward read as anger, so one lifts
      // and the other stays level.
      return (
        <>
          <circle cx="44.5" cy="57" r="5" fill={ink} />
          <circle cx="75.5" cy="57" r="5" fill={ink} />
          <path d="M37 47 Q44.5 42 52 46" stroke={ink} strokeWidth={3} fill="none" strokeLinecap="round" />
          <path d="M68 48 L83 48" stroke={ink} strokeWidth={3} strokeLinecap="round" />
        </>
      );
    }
    return (
      <>
        <circle className="kon__blink" cx="44.5" cy="55" r="5" fill={ink} />
        <circle className="kon__blink" cx="75.5" cy="55" r="5" fill={ink} />
      </>
    );
  })();

  const mouth = (() => {
    switch (state) {
      case 'happy':
      case 'matched':
        return <path d="M46 70 Q60 82 74 70" {...stroke} />;
      case 'congratulations':
        return <path d="M45 68 Q60 86 75 68 Z" fill={ink} />;
      case 'sad':
        return <path d="M48 78 Q60 69 72 78" {...stroke} />;
      case 'failed':
        return <path d="M47 75 Q53 70 60 75 Q67 80 73 75" {...stroke} />;
      case 'empty':
        return <path d="M50 74 L70 74" stroke={ink} strokeWidth={4} strokeLinecap="round" />;
      case 'lost':
        return <ellipse cx="60" cy="76" rx="6" ry="5.5" fill="none" stroke={ink} strokeWidth={3.5} />;
      case 'thinking':
        return <path d="M51 74 Q60 71 69 74" {...stroke} />;
      default:
        return <path d="M49 71 Q60 79 71 71" {...stroke} />;
    }
  })();

  return (
    <g className="kon__face">
      {eyes}
      {mouth}
    </g>
  );
}

export function Mascot({
  state = 'idle',
  size = 96,
  direction = 'right',
  tone,
  label,
  className,
  style
}: MascotProps) {
  useMascotStyles();

  const [deep, bright, pale] = TONES[tone || STATE_TONE[state]];
  const spoken = label === undefined ? DEFAULT_LABEL[state] : label;
  const flip = direction === 'left' && state === 'pointing';

  return (
    <span
      className={['kon', `kon--${state}`, className].filter(Boolean).join(' ')}
      style={{ width: size, height: size, display: 'inline-block', ...style }}
      role={spoken ? 'img' : undefined}
      aria-label={spoken || undefined}
      aria-hidden={spoken ? undefined : true}
    >
      <svg viewBox="0 0 132 124" width="100%" height="100%" focusable="false">
        <g
          className="kon__body"
          transform={
            [
              flip ? 'translate(132,0) scale(-1,1)' : '',
              state === 'lost' ? 'rotate(-13 60 96)' : ''
            ].filter(Boolean).join(' ') || undefined
          }
        >
          <ellipse cx="60" cy="103" rx="30" ry="4" fill={deep} opacity="0.12" />

          {state === 'congratulations' && (
            <g className="kon__confetti">
              <rect x="16" y="22" width="7" height="7" rx="1.5" fill={bright} transform="rotate(20 19 25)" />
              <rect x="98" y="28" width="7" height="7" rx="1.5" fill={pale} transform="rotate(-25 101 31)" />
              <rect x="8" y="54" width="6" height="6" rx="1.5" fill={bright} opacity="0.8" />
              <rect x="106" y="60" width="6" height="6" rx="1.5" fill={bright} opacity="0.7" />
            </g>
          )}

          {state === 'matched' && (
            /* The other half of the match, sliding in behind. */
            <g className="kon__peer">
              <rect x="86" y="40" width="30" height="44" rx="10" fill={pale} />
              <rect x="86" y="40" width="30" height="11" rx="5.5" fill={bright} />
              <circle cx="101" cy="64" r="3.6" fill={deep} opacity="0.55" />
              <rect x="93" y="72" width="16" height="4" rx="2" fill={deep} opacity="0.3" />
            </g>
          )}

          {/* ── The card ──────────────────────────────────────────────── */}
          <g className="kon__card">
            <rect x="18" y="16" width="84" height="80" rx="19" fill={pale} />
            <rect x="18" y="16" width="84" height="18" rx="9" fill={bright} />
            {/* The header bar's name line and status dot. Small, but they are
                what make it a profile card rather than a rounded square. */}
            <rect x="26" y="22" width="22" height="6" rx="3" fill="#FFFFFF" opacity="0.9" />
            <circle cx="92" cy="25" r="3.4" fill="#FFFFFF" opacity="0.9" />
            <Face state={state} ink={deep} />
          </g>

          {state === 'pointing' && (
            <g className="kon__arm">
              <rect x="96" y="63" width="22" height="8" rx="4" fill={bright} />
              <path d="M116 59 L128 67 L116 75 Z" fill={deep} />
            </g>
          )}

          {state === 'thinking' && (
            <g className="kon__think">
              <circle cx="102" cy="26" r="3.2" fill={bright} />
              <circle cx="112" cy="17" r="4.8" fill={bright} opacity="0.75" />
            </g>
          )}

          {state === 'loading' && (
            <g className="kon__dots">
              <circle cx="48" cy="112" r="4" fill={bright} />
              <circle cx="60" cy="112" r="4" fill={bright} />
              <circle cx="72" cy="112" r="4" fill={bright} />
            </g>
          )}

          {state === 'matched' && (
            <>
              <circle className="kon__pulse" cx="60" cy="60" r="52" fill="none" stroke={bright} strokeWidth="2" />
              <g className="kon__link">
                <circle cx="97" cy="98" r="12" fill={deep} />
                <path
                  d="M91 98 L96 103 L104 93"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            </>
          )}

          {state === 'lost' && (
            <text x="98" y="30" fontFamily="Inter, sans-serif" fontSize="26" fontWeight="600" fill={bright}>
              ?
            </text>
          )}
        </g>
      </svg>
    </span>
  );
}

export default Mascot;
