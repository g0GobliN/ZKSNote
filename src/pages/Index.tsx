import { useState, useEffect } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Dashboard } from "@/components/Dashboard";
import { ShareViewer } from "@/components/ShareViewer";
import { getSessionKey } from "@/lib/storage";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isShareView, setIsShareView] = useState(false);

  useEffect(() => {
    // Check for a share link in the URL hash
    if (window.location.hash && window.location.hash.includes("d=")) {
      setIsShareView(true);
      setIsLoading(false);
      return;
    }

    // Otherwise, check for a regular user session
    const sessionKey = getSessionKey();
    setIsAuthenticated(!!sessionKey);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Render the share viewer if the URL is a share link
  if (isShareView) {
    return <ShareViewer />;
  }

  // Render the auth form or dashboard for regular use
  if (!isAuthenticated) {
    return <AuthForm onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return <Dashboard onLogout={() => setIsAuthenticated(false)} />;
};

export default Index;
