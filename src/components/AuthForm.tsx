import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Eye, EyeOff, User } from 'lucide-react';
import { deriveKey, generateSalt, hashPassword } from '@/lib/encryption';
import { getUser, saveUser, saveSession, generateId } from '@/lib/storage';
import { toast } from 'sonner';

interface AuthFormProps {
  onAuthenticated: () => void;
}

export const AuthForm = ({ onAuthenticated }: AuthFormProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const user = getUser();
        if (!user || user.username !== username) {
          toast.error('Invalid credentials');
          return;
        }

        const hashedPassword = hashPassword(password);
        if (hashedPassword !== user.passwordHash) {
          toast.error('Invalid credentials');
          return;
        }

        const encryptionKey = deriveKey(password, user.salt);
        saveSession(encryptionKey);
        toast.success('Welcome back!');
        onAuthenticated();
      } else {
        if (password !== confirmPassword) {
          toast.error('Passwords do not match');
          return;
        }

        if (password.length < 8) {
          toast.error('Password must be at least 8 characters');
          return;
        }

        const existingUser = getUser();
        if (existingUser) {
          toast.error('An account already exists. Please login.');
          setIsLogin(true);
          return;
        }

        const salt = generateSalt();
        const user = {
          id: generateId(),
          username,
          passwordHash: hashPassword(password),
          salt,
        };

        saveUser(user);
        const encryptionKey = deriveKey(password, salt);
        saveSession(encryptionKey);
        
        toast.success('Account created!');
        onAuthenticated();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Secure Notes</h1>
          <p className="text-sm text-muted-foreground">End-to-end encrypted notepad</p>
        </div>

        <div className="bg-card rounded-lg border border-border p-6">
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isLogin 
                  ? 'bg-secondary text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isLogin 
                  ? 'bg-secondary text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setIsLogin(false)}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Processing...' : isLogin ? 'Login' : 'Create Account'}
            </Button>
          </form>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Your data is encrypted locally. We never see your content.
        </p>
      </div>
    </div>
  );
};
