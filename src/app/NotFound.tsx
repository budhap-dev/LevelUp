import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-muted">That page doesn’t exist.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-accent-ink hover:underline">
        Back to the dashboard
      </Link>
    </div>
  );
}
