import React, { useState } from 'react';
import { LogIn, Eye, EyeOff, Mail, Lock } from 'lucide-react';

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onToggleForm: () => void;
  loading: boolean;
  error: string | null;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onLogin,
  onToggleForm,
  loading,
  error,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onLogin(email, password);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <LogIn className="w-8 h-8 text-primary-foreground" />
          </div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h2>
          <p className="text-muted-foreground">Sign in to your TikTok uploader account</p>
        </div>

        {error && (
          <div className="bg-destructive/20 border border-destructive/50 text-destructive-foreground px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-border bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-12 py-3 border border-border bg-input rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Eye className="h-5 w-5 text-muted-foreground" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 px-4 rounded-lg font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <button
            onClick={onToggleForm}
            className="font-medium text-primary hover:text-primary/90 transition-colors"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};
