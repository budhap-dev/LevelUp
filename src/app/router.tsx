import { createBrowserRouter, type RouteObject } from 'react-router';
import { Layout } from './Layout';
import { RouteError } from './RouteError';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { CataloguePage } from '@/features/catalogue/CataloguePage';
import { TopicPage, topicLoader } from '@/features/topic/TopicPage';
import { ComingSoon } from '@/components/ComingSoon';
import { NotFound } from './NotFound';

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
          { path: 'interview', element: <ComingSoon title="Interview Mode" phase={4} /> },
          { path: 'flashcards', element: <ComingSoon title="Flashcards" phase={4} /> },
          { path: 'paths', element: <ComingSoon title="Learning Paths" phase={5} /> },
          { path: 'paths/:pathId', element: <ComingSoon title="Learning Path" phase={5} /> },
          { path: 'bookmarks', element: <ComingSoon title="Bookmarks" phase={3} /> },
          { path: 'settings', element: <ComingSoon title="Settings & backup" phase={3} /> },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
