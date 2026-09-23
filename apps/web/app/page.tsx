import { FREE_MEMBERS_PER_COLLECTIVE } from '@zuund/shared';
import { Icon, type IconName } from '@/components/Icon';
import { ProductArt } from '@/components/ProductArt';
import { VehicleArt } from '@/components/VehicleArt';
import { appLink } from '@/lib/links';

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Post what you are buying',
    body: 'Pick the car or rooftop solar system, your city and when you expect to buy. It takes a minute and it is free.',
  },
  {
    title: 'Meet buyers in your city',
    body: 'See how many real people want the same thing near you, look at their profiles and connect.',
  },
  {
    title: 'Decide together in a collective',
    body: `Discuss, run polls and share what you find. Each collective has ${FREE_MEMBERS_PER_COLLECTIVE} free places; when they are taken, joining is a ₹500 Buying Pass for that post, valid 60 days.`,
  },
];

const PROMISES: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'lock',
    title: 'Your number stays yours',
    body: 'Other buyers see your name, city and what you are buying. Never your phone number or email.',
  },
  {
    icon: 'people',
    title: 'Buyers only',
    body: 'Collectives are for people buying. No dealers or sellers inside, and no sales calls.',
  },
  {
    icon: 'check',
    title: 'Your decision',
    body: 'ZUUND helps you compare notes. Every member chooses and buys on their own terms.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1>
              People. Purchases.
              <br />
              Better together.
            </h1>
            <p className="lead">
              Tell us the car or rooftop solar system you plan to buy. ZUUND shows you the real
              people in your city buying the same, so you can talk, compare and decide together.
            </p>
            <div className="cta-row">
              <a href={appLink('/register')} className="btn light lg">
                Get started, it&apos;s free
              </a>
              <a href={appLink('/login')} className="link-light">
                I already have an account
              </a>
            </div>
          </div>
          <div className="hero-car" aria-hidden>
            <VehicleArt hero width="100%" />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="wrap">
          <h2 className="section-title">How it works</h2>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <span className="step-n" aria-hidden>
                  {i + 1}
                </span>
                <h3>{s.title}</h3>
                <p className="muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section tint">
        <div className="wrap">
          <h2 className="section-title">What you can buy together today</h2>
          <div className="cats">
            <a href={appLink('/search?category=CAR')} className="cat">
              <ProductArt car={{ category: 'CAR', imageUrl: null }} size="md" />
              <div>
                <h3>Cars</h3>
                <p className="muted small">
                  Over 240 models, from hatchbacks to SUVs. Find people buying the same model in
                  your city.
                </p>
              </div>
            </a>
            <a href={appLink('/search?category=SOLAR')} className="cat">
              <ProductArt car={{ category: 'SOLAR', imageUrl: null }} size="md" />
              <div>
                <h3>Rooftop solar</h3>
                <p className="muted small">
                  1 kW to 10 kW and above. Meet neighbours installing the same size and compare
                  notes.
                </p>
              </div>
            </a>
            <a href={appLink('/search?category=HOLIDAY')} className="cat">
              <ProductArt car={{ category: 'HOLIDAY', imageUrl: null }} size="md" />
              <div>
                <h3>Holiday packages</h3>
                <p className="muted small">
                  Domestic or international, from India. Plan the same trip with people from your
                  city.
                </p>
              </div>
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="section-title">Built for trust</h2>
          <div className="promises">
            {PROMISES.map((p) => (
              <div key={p.title} className="promise">
                <span className="promise-icon">
                  <Icon name={p.icon} size={22} />
                </span>
                <h3>{p.title}</h3>
                <p className="muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="closing">
            <h2>Buying soon?</h2>
            <p className="lead">See who else near you is buying the same thing.</p>
            <a href={appLink('/register')} className="btn light lg">
              Create your Buying Post
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
