import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decryptSecureShare, parseShareUrl } from "@/lib/secureSharing";
import { toast } from "sonner";
import { Lock, FileText } from "lucide-react";

interface SharedNote {
  title: string;
  content: string;
  snippets: { id: string; code: string; language: string }[];
}

export const ShareViewer = () => {
  const [note, setNote] = useState<SharedNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const decryptFromUrl = async () => {
      try {
        const params = parseShareUrl(window.location.href);
        if (!params.encryptedData || !params.iv || !params.key) {
          throw new Error("Incomplete share link.");
        }

        const isPasswordProtected = params.key.includes(":");
        setNeedsPassword(isPasswordProtected);

        if (!isPasswordProtected) {
          const decryptedNote = await decryptSecureShare(
            params.encryptedData,
            params.iv,
            params.key,
          );
          setNote(decryptedNote);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to parse share link.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    decryptFromUrl();
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const params = parseShareUrl(window.location.href);
      if (!params.encryptedData || !params.iv || !params.key) {
        throw new Error("Incomplete share link.");
      }
      const decryptedNote = await decryptSecureShare(
        params.encryptedData,
        params.iv,
        params.key,
        password,
      );
      setNote(decryptedNote);
      setNeedsPassword(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Decryption failed. Invalid password?";
      setError(message);
      toast.error(
        "Decryption failed. Please check the password and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="ml-4">Decrypting note...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-destructive">
        <p>Error: {error}</p>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-full max-w-sm px-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Password Protected Note
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter the password to decrypt and view the note.
            </p>
          </div>
          <form
            onSubmit={handlePasswordSubmit}
            className="bg-card rounded-lg border border-border p-6 space-y-4"
          >
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Decrypting..." : "Decrypt Note"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
          <div className="text-center mb-4">
            <a
              href="/"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              ← Back to ZKS Note
            </a>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <h1 className="text-3xl font-bold mb-4">{note.title}</h1>
            {note.content && (
              <div className="prose prose-invert max-w-none whitespace-pre-wrap mb-6">
                {note.content}
              </div>
            )}
            {note.snippets && note.snippets.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold border-t border-border pt-4 mt-6">
                  Code Snippets
                </h2>
                {note.snippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="bg-background rounded-lg border border-border overflow-hidden"
                  >
                    <p className="text-xs text-muted-foreground px-4 py-2 bg-secondary/30">
                      Language: {snippet.language}
                    </p>
                    <pre className="p-4 text-sm overflow-x-auto">
                      <code>{snippet.code}</code>
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
      <FileText className="w-12 h-12 mb-4" />
      <p>No note data found.</p>
    </div>
  );
};
