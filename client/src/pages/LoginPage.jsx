import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import LoginForm from '../components/LoginForm';

/**
 * /login — renders the LoginForm and redirects to / on success.
 */
export default function LoginPage() {
  const { handleLoginSuccess, sessionExpired, credentialsFilePath, setCredentialsFilePath } = useAuth();
  const navigate = useNavigate();

  function onLoginSuccess() {
    handleLoginSuccess();
    navigate('/', { replace: true });
  }

  return (
    <LoginForm
      onLoginSuccess={onLoginSuccess}
      sessionExpired={sessionExpired}
      credentialsFilePath={credentialsFilePath}
      onCredentialsPathReceived={setCredentialsFilePath}
      resetPasswordLink={<Link to="/reset-password" className="login-forgot-btn">Forgot password?</Link>}
    />
  );
}
