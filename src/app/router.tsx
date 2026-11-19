import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './Layout';
import { RouteError } from './RouteError';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CataloguePage } from '@/features/catalogue/CataloguePage';
import { TopicPage, topicLoader } from '@/features/topic/TopicPage';
import { ComingSoon } from '@/components/ComingSoon';
import { NotFound } from './NotFound';
import { BookmarksPage } from '@/features/bookmarks/BookmarksPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { InterviewPage } from '@/features/interview/InterviewPage';
import { FlashcardsPage } from '@/features/flashcards/FlashcardsPage';

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
          { path: 'topics', element: <CataloguePage /> },
          { path: 'topics/:topicId', loader: topicLoader, element: <TopicPage /> },
          { path: 'interview', element: <InterviewPage /> },
          { path: 'flashcards', element: <FlashcardsPage /> },
          { path: 'paths', element: <ComingSoon title="Learning Paths" phase={5} /> },
          { path: 'paths/:pathId', element: <ComingSoon title="Learning Path" phase={5} /> },
          { path: 'bookmarks', element: <BookmarksPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
