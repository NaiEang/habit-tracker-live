import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Tracker from './pages/Tracker'
import UpdateToast from './components/UpdateToast'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Protected Tracker Route */}
          <Route
            path="/tracker"
            element={
              <ProtectedRoute>
                <Tracker />
              </ProtectedRoute>
            }
          />

          {/* Default Redirects */}
          <Route path="/" element={<Navigate to="/tracker" replace />} />
          <Route path="*" element={<Navigate to="/tracker" replace />} />
        </Routes>
        {/* Global PWA Service Worker Update & Offline Ready Toast */}
        <UpdateToast />
      </AuthProvider>
    </BrowserRouter>
  )
}
