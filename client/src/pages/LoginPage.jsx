import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginForm from '../components/auth/LoginForm';

export default function LoginPage() {
  const { handleLoginSuccess, sessionExpired, credentialsFilePath, setCredentialsFilePath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function onLoginSuccess() {
    handleLoginSuccess();
    // Redirect back to the page the user was trying to visit, or / by default
    const destination = location.state?.from?.pathname || '/';
    navigate(destination, { replace: true });
  }

  return (
    <LoginForm
      onLoginSuccess={onLoginSuccess}
      sessionExpired={sessionExpired}
      credentialsFilePath={credentialsFilePath}
      onCredentialsPathReceived={setCredentialsFilePath}
      resetPasswordLink={<Link to="/reset-password">Forgot password?</Link>}
    />
  );
}
