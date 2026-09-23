import type { Metadata } from 'next';
import { SUPPORT_EMAIL, appLink } from '@/lib/links';

export const metadata: Metadata = { title: 'About' };

export default function AboutPage() {
  return (
    <article className="section">
      <div className="wrap prose">
        <h1>About ZUUND</h1>
        <p className="lead">
          Big purchases are usually made alone. ZUUND starts from a simple idea: somewhere in your
          city, other people are about to buy exactly what you are buying.
        </p>
        <h2>What ZUUND does</h2>
        <p>
          You create a Buying Post for the car or rooftop solar system you plan to buy, in your
          city, with your timeline. ZUUND shows you how many others are buying the same, lets you
          connect with them, and brings you together in a collective where you can discuss, run
          polls, share brochures and reviews, and plan meetups.
        </p>
        <h2>What ZUUND is not</h2>
        <p>
          ZUUND is not a dealer or a marketplace. There are no dealers inside collectives, we take
          no commission on what you buy, and we never promise discounts. Every member decides and
          buys for themselves.
        </p>
        <h2>How it is paid for</h2>
        <p>
          Creating a Buying Post, discovering buyers and connecting are free. The first 5 members of
          each collective join free. After that, joining costs a one-time ₹500 Buying Pass for that
          Buying Post, valid for up to 60 days. It never renews on its own.
        </p>
        <h2>Privacy</h2>
        <p>
          Other buyers see your name, photo, city and what you are buying. Your phone number and
          email are never shown. You can block or report anyone at any time.
        </p>
        <p>
          Questions? Write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>, or{' '}
          <a href={appLink('/register')}>create your account</a>.
        </p>
      </div>
    </article>
  );
}
