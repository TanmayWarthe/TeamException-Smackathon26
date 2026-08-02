import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Threats from '../pages/Threats'
import ThreatDetails from '../pages/ThreatDetails'
import DigitalTwins from '../pages/DigitalTwins'
import Notifications from '../pages/Notifications'
import DashboardLayout from '../layouts/DashboardLayout'

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'threats', element: <Threats /> },
      { path: 'threats/:id', element: <ThreatDetails /> },
      { path: 'digital-twins', element: <DigitalTwins /> },
      { path: 'notifications', element: <Notifications /> },
    ],
  },
])