import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useEffect } from 'react';
import '../styles/globals.css';
import '../styles/brand.css';
import '../styles/workforce-platform.css';
import '../styles/navigation.css';
import '../styles/auth.css';
import '../styles/client-intake.css';
import '../styles/talent-signup.css';
import '../styles/talent-portal.css';
import '../styles/talent-onboarding.css';
import '../../../packages/ui/dashboard-theme.css';

/**
 * Two things every page needs, in the one place that wraps all of them.
 *
 * The viewport tag was set per page, by the three pages that remembered. The
 * homepage was not one of them — and in this app the homepage file is also
 * the whole portal, so the marketing site, the signup flow, the onboarding
 * wizard and both dashboards were all rendering without it. A mobile browser
 * with no viewport tag lays the page out at roughly 980px and scales the
 * result down to fit, which is why everything looked shrunken and why
 * tapping a field zoomed further still. Declaring it here covers every page
 * and cannot be forgotten by the next one.
 *
 * It deliberately does not set maximum-scale or user-scalable=no. Those stop
 * the zoom-on-focus behaviour by stopping zoom altogether, which takes it
 * away from people who need it to read. The real cause is text smaller than
 * 16px in a field, and brand.css fixes that instead.
 */
export default function App({ Component, pageProps }: AppProps) {
  useFocusScroll();

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

/**
 * Brings the field you are filling into view.
 *
 * On a phone the on-screen keyboard takes roughly half the screen, and the
 * field you just tapped is often behind it — so you type blind, or scroll by
 * hand between every answer. The long forms here are where that hurts most:
 * onboarding and the service request run to dozens of fields.
 *
 * The delay matters. The keyboard animates in over about a quarter of a
 * second, and scrolling before it has finished measures the old viewport and
 * lands in the wrong place.
 */
function useFocusScroll() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Desktop has no keyboard stealing the viewport, and moving the page
    // under someone with a mouse is an annoyance rather than a help.
    const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isTouch) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;

      const field = target.closest('input, textarea, select, [contenteditable="true"]');
      if (!field) return;

      // A field that opts out — a search box inside a sticky toolbar, say —
      // should stay where it is.
      if ((field as HTMLElement).dataset?.noAutoscroll !== undefined) return;

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          field.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        } catch {
          // Older browsers reject the options object. Not worth a fallback
          // dance: the page simply does not scroll, as it did before.
        }
      }, 280);
    };

    document.addEventListener('focusin', onFocusIn);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, []);
}
