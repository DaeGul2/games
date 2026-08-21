import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import Layout from './ui/Layout';
import Home from './routes/Home';
import RunnerPage from './routes/RunnerPage';
import ShooterPage from './routes/ShooterPage';
import './styles/global.css';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/runner', element: <RunnerPage /> },
      { path: '/shooter', element: <ShooterPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
