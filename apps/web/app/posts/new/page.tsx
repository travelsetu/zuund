import { Suspense } from 'react';
import { CreatePostForm } from '@/components/CreatePostForm';

export default function NewPostPage() {
  return (
    <div className="narrow" style={{ margin: '0 auto' }}>
      <h1>New buying post</h1>
      <Suspense>
        <CreatePostForm />
      </Suspense>
    </div>
  );
}
