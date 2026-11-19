import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const message = isRouteErrorResponse(error)
    ? error.statusText || String(error.data)
    : error instanceof Error
      ? error.message
      : 'Unknown error';

  return (
    <div role="alert" className="mx-auto max-w-xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">{notFound ? 'Not found' : 'Something went wrong'}</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">{message}</p>
      <Link to="/" className="mt-6 inline-block font-medium text-indigo-600 hover:underline dark:text-indigo-400">
        Back to the dashboard
      </Link>
    </div>
  );
}
