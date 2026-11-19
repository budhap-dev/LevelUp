import { Link } from 'react-router';

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">That page doesn’t exist.</p>
      <Link to="/" className="mt-6 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        Back to the dashboard
      </Link>
    </div>
  );
}
