import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CodeEditor } from "@/components/CodeEditor";
import {
  Plus,
  FileText,
  Trash2,
  Save,
  LogOut,
  ChevronDown,
  ChevronRight,
  Code2,
  X,
  Share2,
  Download,
  Upload,
} from "lucide-react";
import {
  Note,
  getNotes,
  saveNote,
  deleteNote,
  getSessionKey,
  clearSession,
  generateId,
} from "@/lib/storage";
import {
  encryptData,
  decryptData,
  deriveKey,
  generateSalt,
} from "@/lib/encryption";
import { toast } from "sonner";
import { createSecureShareLink, SharePayload } from "@/lib/secureSharing";
import { PasswordDialog } from "@/components/PasswordDialog";
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarSeparator,
} from "@/components/ui/sidebar";

interface DashboardProps {
  onLogout: () => void;
}

interface CodeSnippet {
  id: string;
  code: string;
  language: string;
}

interface ExpandedCodeSnippet extends CodeSnippet {
  isExpanded: boolean;
}

// This represents the decrypted content of a note
interface NoteContent {
  content: string;
  snippets: CodeSnippet[];
}

// Extends NoteContent for imported files that might have extra metadata
interface ImportedNote extends NoteContent {
  title?: string;
  createdAt?: number;
}

const LANGUAGES = [
  { value: "plaintext", label: "Plain Text" },
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "java", label: "Java" },
  { value: "csharp", label: "C#" },
  { value: "cpp", label: "C++" },
  { value: "go", label: "Go" },
  { value: "rust", label: "Rust" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "sql", label: "SQL" },
  { value: "markdown", label: "Markdown" },
];

export const Dashboard = ({ onLogout }: DashboardProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [codeSnippets, setCodeSnippets] = useState<ExpandedCodeSnippet[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordDialogOptions, setPasswordDialogOptions] = useState<{
    title: string;
    description: string;
    onConfirm: (password: string) => Promise<void>;
  }>({ title: "", description: "", onConfirm: async () => {} });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const encryptionKey = getSessionKey();

  useEffect(() => {
    if (!encryptionKey) {
      toast.error("Session expired or key is missing. Please log in again.");
      onLogout();
      return;
    }
    setNotes(getNotes());
  }, [encryptionKey, onLogout]);

  const filteredNotes = notes.filter((note) => 
    note.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleCreateNote = async () => {
    if (!encryptionKey) return;

    const emptyPayload: NoteContent = { content: "", snippets: [] };
    const { encryptedData, iv } = await encryptData(
      JSON.stringify(emptyPayload),
      encryptionKey,
    );

    const newNote: Note = {
      id: generateId(),
      title: "Untitled Note",
      encryptedContent: { data: encryptedData, iv: iv },
      language: "plaintext",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveNote(newNote);
    setNotes([...notes, newNote]);
    await handleSelectNote(newNote);
    toast.success("New note created");
  };

  const handleSelectNote = async (note: Note) => {
    if (!encryptionKey) return;
    if (hasUnsavedChanges && selectedNote) {
      await handleSaveNote();
    }

    try {
      const decrypted = await decryptData(
        note.encryptedContent.data,
        encryptionKey,
        note.encryptedContent.iv,
      );
      if (decrypted) {
        const parsed: NoteContent = JSON.parse(decrypted);
        setEditingContent(parsed.content || "");
        setCodeSnippets(
          (parsed.snippets || []).map((s) => ({
            ...s,
            isExpanded: false,
          })),
        );
      }
    } catch (error) {
      console.error("Decryption failed:", error);
      toast.error(
        "Failed to decrypt note. The key might be wrong or data corrupted.",
      );
      setEditingContent("");
      setCodeSnippets([]);
    }

    setEditingTitle(note.title);
    setSelectedNote(note);
    setHasUnsavedChanges(false);
    setIsEditingNote(false);
  };

  const handleSaveNote = async () => {
    if (!selectedNote || !encryptionKey) return;

    const snippetsToSave: CodeSnippet[] = codeSnippets.map(
      ({ id, code, language }) => ({
        id,
        code,
        language,
      }),
    );
    const payload: NoteContent = {
      content: editingContent,
      snippets: snippetsToSave,
    };
    const { encryptedData, iv } = await encryptData(
      JSON.stringify(payload),
      encryptionKey,
    );

    const updatedNote: Note = {
      ...selectedNote,
      title: editingTitle,
      encryptedContent: { data: encryptedData, iv: iv },
      updatedAt: Date.now(),
    };

    saveNote(updatedNote);
    setNotes(notes.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
    setSelectedNote(updatedNote);
    setHasUnsavedChanges(false);
    toast.success("Note saved");
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    setNotes(notes.filter((n) => n.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
      setEditingContent("");
      setCodeSnippets([]);
      setEditingTitle("");
    }
    toast.success("Note deleted");
  };

  const handleLogout = async () => {
    if (hasUnsavedChanges && selectedNote) {
      await handleSaveNote();
    }
    clearSession();
    onLogout();
  };

  const addCodeSnippet = () => {
    const newSnippet: ExpandedCodeSnippet = {
      id: `code${codeSnippets.length + 1}`,
      code: "",
      language: "javascript",
      isExpanded: true,
    };
    setCodeSnippets([...codeSnippets, newSnippet]);
    setHasUnsavedChanges(true);
  };

  const updateSnippet = (id: string, updates: Partial<ExpandedCodeSnippet>) => {
    setCodeSnippets((snippets) =>
      snippets.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    );
    setHasUnsavedChanges(true);
  };

  const removeSnippet = (id: string) => {
    setCodeSnippets((snippets) => snippets.filter((s) => s.id !== id));
    setHasUnsavedChanges(true);
  };

  const toggleSnippet = (id: string) => {
    setCodeSnippets((snippets) =>
      snippets.map((s) =>
        s.id === id ? { ...s, isExpanded: !s.isExpanded } : s,
      ),
    );
  };

  const insertCodeTag = (snippetId: string) => {
    const tag = `[${snippetId}]`;
    setEditingContent((prev) => prev + tag);
    setHasUnsavedChanges(true);
  };

  const handleSecureShare = async () => {
    const shareAction = async (password?: string) => {
      try {
        const payload: SharePayload = {
          title: editingTitle,
          content: editingContent,
          snippets: codeSnippets.map(({ id, code, language }) => ({
            id,
            code,
            language,
          })),
        };
        const { link } = await createSecureShareLink(payload, {
          password: password || undefined,
        });
        await navigator.clipboard.writeText(link);
        toast.success("Secure link copied to clipboard!");
      } catch (error) {
        console.error("Failed to create secure link:", error);
        toast.error("Failed to create secure link");
      }
    };

    if (window.confirm("Add password protection to this share link?")) {
      setPasswordDialogOptions({
        title: "Password Protect Link",
        description: "Enter a password to encrypt the share link.",
        onConfirm: shareAction,
      });
      setIsPasswordDialogOpen(true);
    } else {
      await shareAction();
    }
  };

  const handleSecureExport = async () => {
  const exportAction = async (password: string) => {
    if (!password) {
      toast.error("A password is required for secure export.");
      return;
    }
    try {
      const salt = generateSalt();
      const cryptoKey = await deriveKey(password, new Uint8Array(salt).buffer);
      
      const dataToExport: NoteContent = {
        content: editingContent,
        snippets: codeSnippets.map(({ id, code, language }) => ({
          id,
          code,
          language,
        })),
      };
      const { encryptedData, iv } = await encryptData(
        JSON.stringify(dataToExport),
        cryptoKey,  // Pass the CryptoKey directly
      );

        const blob = new Blob(
          [
            JSON.stringify(
              {
                encryptedData,
                iv,
                salt: Array.from(salt),
                version: "2.0-export",
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        );

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `secure-note-${editingTitle.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.snote`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success("Note exported securely!");
      } catch (error) {
        console.error("Export failed:", error);
        toast.error("Failed to export note");
      }
    };

    setPasswordDialogOptions({
      title: "Set Export Password",
      description:
        "This password will be required to decrypt the exported file.",
      onConfirm: exportAction,
    });
    setIsPasswordDialogOpen(true);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      try {
        if (file.name.endsWith(".snote")) {
          const importAction = async (password: string) => {
            if (!password) {
              toast.error("Password is required to import this file.");
              return;
            }
            try {
              const parsed = JSON.parse(content);
              const salt = new Uint8Array(parsed.salt);
              const key = await deriveKey(password, new Uint8Array(salt).buffer);
              const decrypted = await decryptData(
                parsed.encryptedData,
                key,
                parsed.iv,
              );
              const importedData: NoteContent = JSON.parse(decrypted);
              await createNoteFromData(importedData);
              toast.success("Secure note imported successfully!");
            } catch (err) {
              console.error(err);
              toast.error("Import failed. Invalid password or corrupted file.");
            }
          };
          setPasswordDialogOptions({
            title: "Enter Import Password",
            description: `Enter the password for "${file.name}".`,
            onConfirm: importAction,
          });
          setIsPasswordDialogOpen(true);
        } else {
          // Handle plain JSON import
          const importedNote: ImportedNote = JSON.parse(content);
          await createNoteFromData(
            importedNote,
            `Imported: ${importedNote.title || "Untitled"}`,
          );
          toast.success(`Imported 1 note successfully!`);
        }
      } catch (err) {
        toast.error("Invalid file format.");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  const createNoteFromData = async (data: ImportedNote, title?: string) => {
    if (!encryptionKey) return;
    const payload: NoteContent = {
      content: data.content || "",
      snippets: data.snippets || [],
    };
    const { encryptedData, iv } = await encryptData(
      JSON.stringify(payload),
      encryptionKey,
    );
    const newNote: Note = {
      id: generateId(),
      title: title || data.title || "Imported Note",
      encryptedContent: { data: encryptedData, iv: iv },
      language: "plaintext",
      createdAt: data.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    saveNote(newNote);
    setNotes((prev) => [...prev, newNote]);
  };

  const renderContentWithTags = () => {
    const parts = editingContent.split(/(\[code\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[(code\d+)\]/);
      if (match) {
        const snippetId = match[1];
        const snippet = codeSnippets.find((s) => s.id === snippetId);
        if (snippet) {
          return (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                toggleSnippet(snippetId);
              }}
              className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded bg-primary/20 text-primary text-xs font-mono hover:bg-primary/30 transition-colors cursor-pointer"
            >
              <Code2 className="w-3 h-3" />
              {snippetId}
            </button>
          );
        }
        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded bg-muted text-muted-foreground text-xs font-mono"
          >
            <Code2 className="w-3 h-3" />
            {snippetId}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <h1 className="text-sm font-semibold text-foreground px-2">Notes</h1>
        </SidebarHeader>
        <SidebarContent>
            {/* Search bar */}
          <div className="px-2 pb-2 pt-2">
            <Input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
          </div>
          <SidebarMenu>
           {filteredNotes.map((note) => (
  <SidebarMenuItem key={note.id}>
    <SidebarMenuButton
      onClick={() => handleSelectNote(note)}
      isActive={selectedNote?.id === note.id}
      className="w-full"
    >
      <FileText className="w-4 h-4" />
      <span className="truncate">{note.title}</span>
    </SidebarMenuButton>
  </SidebarMenuItem>
))}

          </SidebarMenu>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleCreateNote} className="w-full">
                <Plus className="w-4 h-4 mr-2" /> New Note
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleSecureExport}
                disabled={!selectedNote}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" /> Export
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => fileInputRef.current?.click()}
                className="w-full"
              >
                <Upload className="w-4 h-4 mr-2" /> Import
              </SidebarMenuButton>
            </SidebarMenuItem>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.snote"
              onChange={handleFileImport}
              className="hidden"
            />
            <SidebarMenuItem>
              <SidebarMenuButton onClick={handleLogout} className="w-full">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        {selectedNote ? (
          <div className="w-full flex-1 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                 <div className="hidden md:block">
                  {/* <Input
                    placeholder="Search notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-44 text-sm"
                  /> */}
                </div>
                <SidebarTrigger className="md:hidden" />
                <Input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => {
                    setEditingTitle(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  className="text-lg font-medium bg-transparent border-none focus-visible:ring-0 px-0 h-auto flex-1"
                  placeholder="Note title..."
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSecureShare}
                  variant="outline"
                  size="sm"
                  disabled={!selectedNote}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button onClick={handleSaveNote} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
                <Button
                  onClick={() => handleDeleteNote(selectedNote.id)}
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin w-full">
              <div className="max-w-3xl w-full mx-auto space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      Note
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => setIsEditingNote(!isEditingNote)}
                    >
                      {isEditingNote ? "Done" : "Edit"}
                    </Button>
                  </div>
                  {isEditingNote ? (
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">
                        Use [code1], [code2]... to reference snippets
                      </span>
                      <textarea
                        value={editingContent}
                        onChange={(e) => {
                          setEditingContent(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="Write your notes here... Use [code1], [code2] etc. to reference code snippets below."
                        className="w-full min-h-[280px] bg-card rounded-lg p-4 text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary/30 border border-border"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full min-h-[280px] bg-card rounded-lg p-4 text-sm text-foreground border border-border cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() => !editingContent && setIsEditingNote(true)}
                    >
                      {editingContent ? (
                        <div className="whitespace-pre-wrap leading-relaxed">
                          {renderContentWithTags()}
                        </div>
                      ) : (
                        <span
                          className="text-muted-foreground"
                          onClick={() => setIsEditingNote(true)}
                        >
                          Click to add notes... Use [code1], [code2] etc. to
                          reference code snippets.
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">
                      Code Snippets
                    </span>
                    <Button
                      onClick={addCodeSnippet}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Add Snippet
                    </Button>
                  </div>
                  {codeSnippets.map((snippet) => (
                    <div
                      key={snippet.id}
                      className="bg-card rounded-lg border border-border overflow-hidden"
                    >
                      <div
                        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-secondary/30"
                        onClick={() => toggleSnippet(snippet.id)}
                      >
                        <div className="flex items-center gap-3">
                          {snippet.isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-mono text-primary">
                            [{snippet.id}]
                          </span>
                          <select
                            value={snippet.language}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateSnippet(snippet.id, {
                                language: e.target.value,
                              });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 px-2 rounded bg-secondary border-none text-xs text-muted-foreground focus:outline-none"
                          >
                            {LANGUAGES.map((lang) => (
                              <option key={lang.value} value={lang.value}>
                                {lang.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              insertCodeTag(snippet.id);
                            }}
                          >
                            Insert tag
                          </Button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSnippet(snippet.id);
                            }}
                            className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      {snippet.isExpanded && (
                        <div className="h-48 border-t border-border">
                          <CodeEditor
                            value={snippet.code}
                            onChange={(value) =>
                              updateSnippet(snippet.id, { code: value })
                            }
                            language={snippet.language}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {codeSnippets.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No code snippets yet. Click "Add Snippet" to create one.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <SidebarTrigger className="md:hidden" />
                <p className="text-muted-foreground text-sm">
                  Select a note or create a new one
                </p>
              </div>
              <Button onClick={handleCreateNote} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Note
              </Button>
            </div>
          </div>
        )}
      </SidebarInset>

      <PasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
        title={passwordDialogOptions.title}
        description={passwordDialogOptions.description}
        onConfirm={passwordDialogOptions.onConfirm}
      />
    </SidebarProvider>
  );
};
