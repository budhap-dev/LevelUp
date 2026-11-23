import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './Layout';
import { RouteError } from './RouteError';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { NotFound } from './NotFound';

/**
 * The dashboard is the landing page, so it ships in the main bundle. Every other page is a
 * separate chunk, loaded the first time its route is visited.
 */
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      {
        errorElement: <RouteError />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'topics', lazy: async () => ({ Component: (await import('@/features/catalogue/CataloguePage')).CataloguePage }) },
          {
            path: 'topics/:topicId',
            lazy: async () => {
              const m = await import('@/features/topic/TopicPage');
              return { Component: m.TopicPage, loader: m.topicLoader };
            },
          },
          { path: 'interview', lazy: async () => ({ Component: (await import('@/features/interview/InterviewPage')).InterviewPage }) },
          { path: 'flashcards', lazy: async () => ({ Component: (await import('@/features/flashcards/FlashcardsPage')).FlashcardsPage }) },
          { path: 'paths', lazy: async () => ({ Component: (await import('@/features/paths/PathsPage')).PathsPage }) },
          { path: 'paths/:pathId', lazy: async () => ({ Component: (await import('@/features/paths/PathPage')).PathPage }) },
          { path: 'bookmarks', lazy: async () => ({ Component: (await import('@/features/bookmarks/BookmarksPage')).BookmarksPage }) },
          { path: 'notes', lazy: async () => ({ Component: (await import('@/features/notes/NotesPage')).NotesPage }) },
          { path: 'settings', lazy: async () => ({ Component: (await import('@/features/settings/SettingsPage')).SettingsPage }) },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
