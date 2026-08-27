import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './ui/Layout';
import Home from './routes/Home';
import RunnerPage from './routes/RunnerPage';
import ShooterPage from './routes/ShooterPage';
import TowerPage from './routes/TowerPage';
import MergePage from './routes/MergePage';
import ArrowPage from './routes/ArrowPage';
import './styles/global.css';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/runner', element: <RunnerPage /> },
      { path: '/shooter', element: <ShooterPage /> },
      { path: '/tower', element: <TowerPage /> },
      { path: '/merge', element: <MergePage /> },
      { path: '/arrow', element: <ArrowPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

// 행사장 네트워크가 끊겨도 부스에서 계속 플레이할 수 있도록 정적 자원을 캐시한다
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* 등록 실패해도 게임 자체는 정상 동작하므로 무시 */
    });
  });
}
