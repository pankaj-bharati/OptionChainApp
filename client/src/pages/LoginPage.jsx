import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginForm from '../components/auth/LoginForm';

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
      resetPasswordLink={<Link to="/reset-password">Forgot password?</Link>}
    />
  );
}
