import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { useAuth } from '../../hooks/useAuth';

export const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const { signIn, signUp, loading, error } = useAuth();

  const handleLogin = async (email: string, password: string) => {
    await signIn(email, password);
  };

  const handleSignup = async (email: string, password: string) => {
    await signUp(email, password);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {isLogin ? (
          <LoginForm
            onLogin={handleLogin}
            onToggleForm={() => setIsLogin(false)}
            loading={loading}
            error={error}
          />
        ) : (
          <SignupForm
            onSignup={handleSignup}
            onToggleForm={() => setIsLogin(true)}
            loading={loading}
            error={error}
          />
        )}
      </div>
    </div>
  );
};
