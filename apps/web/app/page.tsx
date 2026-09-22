import { Suspense } from 'react';
import { CreatePostForm } from '@/components/CreatePostForm';

export default function HomePage() {
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <section className="hero">
        <h1>What car are you looking to buy?</h1>
        <p className="muted">
          Find other people in your city who want the same car. Connect, compare notes, and buy
          together.
        </p>
      </section>
      <Suspense>
        <CreatePostForm />
      </Suspense>
    </div>
  );
}
