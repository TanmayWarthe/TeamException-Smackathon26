import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import Threats from '../pages/Threats'
import ThreatDetails from '../pages/ThreatDetails'
import DigitalTwins from '../pages/DigitalTwins'
import Notifications from '../pages/Notifications'
import DashboardLayout from '../layouts/DashboardLayout'
import ProtectedRoute from '../components/ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'threats', element: <Threats /> },
          { path: 'threats/:id', element: <ThreatDetails /> },
          { path: 'digital-twins', element: <DigitalTwins /> },
          { path: 'notifications', element: <Notifications /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])