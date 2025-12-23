import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, User, ShieldCheck } from "lucide-react";
import {
  deriveKey,
  hashPassword,
  generateSalt,
  base64ToArrayBuffer,
  arrayBufferToBase64,
} from "@/lib/encryption";
import { getUser, saveUser, saveSessionKey, generateId } from "@/lib/storage";
import { toast } from "sonner";

interface AuthFormProps {
  onAuthenticated: () => void;
}

export const AuthForm = ({ onAuthenticated }: AuthFormProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isLogin) {
        const user = getUser();
        if (!user || user.username.toLowerCase() !== username.toLowerCase()) {
          toast.error("Invalid credentials");
          return;
        }

        const salt = new Uint8Array(base64ToArrayBuffer(user.salt));
        const { hash } = await hashPassword(password, salt);

        if (hash !== user.passwordHash) {
          toast.error("Invalid credentials");
          return;
        }

        const encryptionKey = await deriveKey(password, salt);
        saveSessionKey(encryptionKey);
        toast.success("Welcome back!");
        onAuthenticated();
      } else {
        if (password !== confirmPassword) {
          toast.error("Passwords do not match");
          return;
        }

        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          return;
        }

        const existingUser = getUser();
        if (existingUser) {
          toast.error("An account already exists. Please login.");
          setIsLogin(true);
          return;
        }

        const salt = generateSalt();
        const { hash: passwordHash } = await hashPassword(password, salt);

        const user = {
          id: generateId(),
          username,
          passwordHash,
          salt: arrayBufferToBase64(salt),
        };

        saveUser(user);
        const encryptionKey = await deriveKey(password, salt);
        saveSessionKey(encryptionKey);

        toast.success("Account created successfully!");
        onAuthenticated();
      }
    } catch (error) {
      console.error("Authentication error:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black p-4">
      {/* Background Decorative Element */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-[400px] z-10">
        <div className="text-center mb-10 space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            ZKS-NOTE
          </h1>
          <p className="text-muted-foreground">
            Secure, zero-knowledge architecture.
          </p>
        </div>

        <div className="bg-card/50 backdrop-blur-xl rounded-3xl border border-white/10 p-8 shadow-2xl">
          {/* Tab Switcher */}
          <div className="flex p-1 bg-black/20 rounded-xl mb-8 border border-white/5">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                isLogin ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
              onClick={() => setIsLogin(true)}
            >
              Login
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                !isLogin ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-white"
              }`}
              onClick={() => setIsLogin(false)}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Username
              </label>
              <div className="relative group">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder="Your unique ID"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all h-11"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all h-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Confirm Key
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-black/20 border-white/10 focus:border-primary/50 focus:ring-primary/20 transition-all h-11"
                    required
                  />
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all shadow-lg shadow-primary/20"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : isLogin ? (
                "Access Vault"
              ) : (
                "Initialize Account"
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/5 border border-emerald-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-500/80">
              End-to-End Encrypted
            </span>
          </div>
          <p className="text-xs text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
            Your master password never leaves this device. 
            All encryption happens locally.
          </p>
        </div>
      </div>
    </div>
  );
};