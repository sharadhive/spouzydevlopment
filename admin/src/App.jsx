import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import PermissionRoute from './components/PermissionRoute';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ContentDashboardPage from './pages/ContentDashboardPage';
import EnquiriesPage from './pages/EnquiriesPage';
import ClinicalPage from './pages/ClinicalPage';
import CareersPage from './pages/CareersPage';
import AppointmentsPage from './pages/AppointmentsPage';
import ContentPage from './pages/ContentPage';
import SettingsPage from './pages/SettingsPage';
import UsersAuditPage from './pages/UsersAuditPage';
import ShopPage from './pages/ShopPage';
import ChatsPage from './pages/ChatsPage';
import GuidePage from './pages/GuidePage';
import NotificationsPage from './pages/NotificationsPage';
import VerificationsPage from './pages/VerificationsPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#FAF7F2',
        color: '#4B2030'
      }}>
        <i className="fa fa-spinner fa-spin fa-2x"></i>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ErrorBoundary fullScreen>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<DashboardPage />} />
              <Route path="content-dashboard" element={
                <PermissionRoute required={['content:view', 'blogs:view', 'moderation:view']} moduleName="Content Hub">
                  <ContentDashboardPage />
                </PermissionRoute>
              } />
              <Route path="enquiries" element={
                <PermissionRoute required="enquiries:view" moduleName="Enquiries CRM">
                  <EnquiriesPage />
                </PermissionRoute>
              } />
              <Route path="clinical" element={
                <PermissionRoute required="clinical_apps:view" moduleName="Clinical Staff Applications">
                  <ClinicalPage />
                </PermissionRoute>
              } />
              <Route path="careers" element={
                <PermissionRoute required="careers:view" moduleName="Careers Desk">
                  <CareersPage />
                </PermissionRoute>
              } />
              <Route path="appointments" element={
                <PermissionRoute required="appointments:view" moduleName="Appointments &amp; Scheduling">
                  <AppointmentsPage />
                </PermissionRoute>
              } />
              <Route path="chats" element={
                <PermissionRoute required="enquiries:view" moduleName="Website Chat">
                  <ChatsPage />
                </PermissionRoute>
              } />
              <Route path="shop" element={
                <PermissionRoute required={['orders:view', 'packages:view', 'offers:view']} moduleName="Packages &amp; Orders">
                  <ShopPage />
                </PermissionRoute>
              } />
              <Route path="verifications" element={
                <PermissionRoute required="verifications:view" moduleName="Student &amp; Ex-servicemen IDs">
                  <VerificationsPage />
                </PermissionRoute>
              } />
              <Route path="content" element={
                <PermissionRoute required={['content:view', 'blogs:view', 'moderation:view']} moduleName="Content &amp; Media">
                  <ContentPage />
                </PermissionRoute>
              } />
              <Route path="settings" element={
                <PermissionRoute required={['settings:content', 'settings:gateway']} moduleName="System Settings">
                  <SettingsPage />
                </PermissionRoute>
              } />
              <Route path="users" element={
                <PermissionRoute required="users:view" moduleName="Staff &amp; Security">
                  <UsersAuditPage />
                </PermissionRoute>
              } />
              <Route path="guide" element={<GuidePage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
