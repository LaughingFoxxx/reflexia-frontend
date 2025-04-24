import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import LoginPage from './LoginPage.jsx';
import LandingPage from './LandingPage.jsx';
import VerificationPage from './VerificationPage.jsx';
import ResetPasswordPage from './ResetPasswordPage.jsx';
import NewPasswordPage from './NewPasswordPage.jsx';
import { useState, useEffect } from 'react';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await fetch('http://localhost:8082/api/auth/validate-access-token', {
                    method: 'POST',
                    credentials: 'include',
                });
                setIsAuthenticated(response.ok);
            } catch (error) {
                console.error('Auth check failed:', error);
                setIsAuthenticated(false);
            }
        };
        checkAuth();
    }, []);

    if (isAuthenticated === null) {
        return <div>Loading...</div>; // Or a spinner
    }

    return isAuthenticated ? children : <Navigate to="/login" replace />;
};

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/verify" element={<VerificationPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/new-password" element={<NewPasswordPage />} />
                <Route
                    path="/app"
                    element={
                        <ProtectedRoute>
                            <App />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </BrowserRouter>
    </StrictMode>
);