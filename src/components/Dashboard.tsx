import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CodeEditor } from '@/components/CodeEditor';
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
  Upload
} from 'lucide-react';
import { Note, getNotes, saveNote, deleteNote, getSession, clearSession, generateId } from '@/lib/storage';
import { encryptContent, decryptContent } from '@/lib/encryption';
import { toast } from 'sonner';
import { createSecureShareLink } from '@/lib/secureSharing';
import { generateKey, encryptData, decryptData, generateSalt } from '@/lib/encryption';
import { PasswordDialog } from '@/components/PasswordDialog';

interface DashboardProps {
  onLogout: () => void;
}

interface CodeSnippet {
  id: string;
  code: string;
  language: string;
  isExpanded: boolean;
}

const LANGUAGES = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'sql', label: 'SQL' },
  { value: 'markdown', label: 'Markdown' },
];

export const Dashboard = ({ onLogout }: DashboardProps) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [codeSnippets, setCodeSnippets] = useState<CodeSnippet[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordAction, setPasswordAction] = useState<(password?: string) => Promise<void>>(async () => {});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const encryptionKey = getSession()?.encryptionKey || '';

  useEffect(() => {
    setNotes(getNotes());
  }, []);

  const handleCreateNote = () => {
    const newNote: Note = {
      id: generateId(),
      title: 'Untitled Note',
      encryptedContent: encryptContent(JSON.stringify({ content: '', snippets: [] }), encryptionKey),
      language: 'plaintext',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    saveNote(newNote);
    setNotes([...notes, newNote]);
    handleSelectNote(newNote);
    toast.success('New note created');
  };

  const handleSelectNote = (note: Note) => {
    if (hasUnsavedChanges && selectedNote) {
      handleSaveNote();
    }

    const decrypted = decryptContent(note.encryptedContent, encryptionKey);
    if (decrypted) {
      try {
        const parsed = JSON.parse(decrypted);
        setEditingContent(parsed.content || '');
        setCodeSnippets((parsed.snippets || []).map((s: any) => ({ ...s, isExpanded: false })));
      } catch {
        setEditingContent(decrypted);
        setCodeSnippets([]);
      }
    } else {
      setEditingContent('');
      setCodeSnippets([]);
      toast.error('Failed to decrypt note');
    }
    
    setEditingTitle(note.title);
    setSelectedNote(note);
    setHasUnsavedChanges(false);
    setIsEditingNote(false);
  };

  const handleSaveNote = () => {
    if (!selectedNote) return;

    const snippetsToSave = codeSnippets.map(({ id, code, language }) => ({ id, code, language }));
    const payload = JSON.stringify({ content: editingContent, snippets: snippetsToSave });
    const encryptedContent = encryptContent(payload, encryptionKey);

    const updatedNote: Note = {
      ...selectedNote,
      title: editingTitle,
      encryptedContent,
      updatedAt: Date.now(),
    };

    saveNote(updatedNote);
    setNotes(notes.map(n => n.id === updatedNote.id ? updatedNote : n));
    setSelectedNote(updatedNote);
    setHasUnsavedChanges(false);
    toast.success('Note saved');
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(id);
    setNotes(notes.filter(n => n.id !== id));
    if (selectedNote?.id === id) {
      setSelectedNote(null);
      setEditingContent('');
      setCodeSnippets([]);
      setEditingTitle('');
    }
    toast.success('Note deleted');
  };

  const handleLogout = () => {
    if (hasUnsavedChanges && selectedNote) {
      handleSaveNote();
    }
    clearSession();
    onLogout();
  };

  const addCodeSnippet = () => {
    const newSnippet: CodeSnippet = {
      id: `code${codeSnippets.length + 1}`,
      code: '',
      language: 'javascript',
      isExpanded: true,
    };
    setCodeSnippets([...codeSnippets, newSnippet]);
    setHasUnsavedChanges(true);
  };

  const updateSnippet = (id: string, updates: Partial<CodeSnippet>) => {
    setCodeSnippets(snippets => 
      snippets.map(s => s.id === id ? { ...s, ...updates } : s)
    );
    setHasUnsavedChanges(true);
  };

  const removeSnippet = (id: string) => {
    setCodeSnippets(snippets => snippets.filter(s => s.id !== id));
    setHasUnsavedChanges(true);
  };

  const toggleSnippet = (id: string) => {
    setCodeSnippets(snippets => 
      snippets.map(s => s.id === id ? { ...s, isExpanded: !s.isExpanded } : s)
    );
  };

  const insertCodeTag = (snippetId: string) => {
    const tag = `[${snippetId}]`;
    setEditingContent(prev => prev + tag);
    setHasUnsavedChanges(true);
  };

  // Secure share note
  const handleSecureShare = async () => {
    setPasswordAction(async (password?: string) => {
      try {
        const { link } = await createSecureShareLink(
          {
            title: editingTitle,
            content: editingContent,
            snippets: codeSnippets,
            metadata: {
              createdAt: selectedNote?.createdAt || Date.now(),
              updatedAt: Date.now()
            }
          },
          { password: password || undefined }
        );
        await navigator.clipboard.writeText(link);
        toast.success('Secure link copied to clipboard!');
      } catch (error) {
        console.error('Failed to create secure link:', error);
        toast.error('Failed to create secure link');
      }
    });

    // Ask if user wants to add password protection
    if (confirm('Add password protection to this link?')) {
      setIsPasswordDialogOpen(true);
    } else {
      passwordAction();
    }
  };

  // Secure export note
  const handleSecureExport = async () => {
    setPasswordAction(async (password: string) => {
      try {
        const data = {
          version: '1.0',
          timestamp: new Date().toISOString(),
          title: editingTitle,
          content: editingContent,
          snippets: codeSnippets,
          metadata: {
            createdAt: selectedNote?.createdAt || Date.now(),
            updatedAt: Date.now()
          }
        };

        const { encryptedData, iv } = await encryptData(JSON.stringify(data), password);
        const salt = generateSalt();
        
        const blob = new Blob([JSON.stringify({
          encryptedData,
          iv,
          salt,
          version: '1.0'
        }, null, 2)], { type: 'application/json' });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `secure-note-${editingTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.snote`;
        a.click();
        URL.revokeObjectURL(url);
        
        toast.success('Note exported securely!');
      } catch (error) {
        console.error('Export failed:', error);
        toast.error('Failed to export note');
      }
    });
    
    setIsPasswordDialogOpen(true);
  };

  // Import notes from JSON file
  const handleImportNotes = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        const notesArray = Array.isArray(imported) ? imported : [imported];
        
        let importedCount = 0;
        notesArray.forEach((noteData: any) => {
          const payload = JSON.stringify({
            content: noteData.content || '',
            snippets: noteData.snippets || [],
          });
          
          const newNote: Note = {
            id: generateId(),
            title: noteData.title || 'Imported Note',
            encryptedContent: encryptContent(payload, encryptionKey),
            language: 'plaintext',
            createdAt: noteData.createdAt || Date.now(),
            updatedAt: Date.now(),
          };
          
          saveNote(newNote);
          importedCount++;
        });
        
        setNotes(getNotes());
        toast.success(`Imported ${importedCount} note(s) successfully!`);
      } catch (err) {
        toast.error('Invalid JSON file. Please check the format.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Render note content with code tags highlighted
  const renderContentWithTags = () => {
    const parts = editingContent.split(/(\[code\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[(code\d+)\]/);
      if (match) {
        const snippetId = match[1];
        const snippet = codeSnippets.find(s => s.id === snippetId);
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
        // Show tag even if snippet not found (greyed out)
        return (
          <span key={index} className="inline-flex items-center gap-1 px-2 py-0.5 mx-1 rounded bg-muted text-muted-foreground text-xs font-mono">
            <Code2 className="w-3 h-3" />
            {snippetId}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Sidebar */}
      <div className="w-56 bg-sidebar-background border-r border-sidebar-border flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <h1 className="text-sm font-semibold text-sidebar-foreground">Notes</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => handleSelectNote(note)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                selectedNote?.id === note.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
              }`}
            >
              <FileText className="w-4 h-4 flex-shrink-0 opacity-60" />
              <span className="truncate">{note.title}</span>
            </button>
          ))}
        </div>

        <div className="p-2 border-t border-sidebar-border space-y-1">
          <Button onClick={handleCreateNote} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <Plus className="w-4 h-4 mr-2" />
            New Note
          </Button>
          <Button 
            onClick={handleSecureExport} 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground"
            disabled={!selectedNote}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Securely
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportNotes}
            className="hidden"
          />
          <Button onClick={handleLogout} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedNote ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <Input
                type="text"
                value={editingTitle}
                onChange={(e) => {
                  setEditingTitle(e.target.value);
                  setHasUnsavedChanges(true);
                }}
                className="text-lg font-medium bg-transparent border-none focus-visible:ring-0 px-0 h-auto max-w-md"
                placeholder="Note title..."
              />
              <div className="flex items-center gap-2">
                <Button 
                  onClick={handleSecureShare} 
                  variant="outline" 
                  size="sm" 
                  title="Share securely"
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
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              <div className="max-w-3xl mx-auto space-y-4">
                {/* Note Content */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Note</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs"
                      onClick={() => setIsEditingNote(!isEditingNote)}
                    >
                      {isEditingNote ? 'Done' : 'Edit'}
                    </Button>
                  </div>
                  
                  {isEditingNote ? (
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground">Use [code1], [code2]... to reference snippets</span>
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
                        <span className="text-muted-foreground" onClick={() => setIsEditingNote(true)}>
                          Click to add notes... Use [code1], [code2] etc. to reference code snippets.
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Code Snippets */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Code Snippets</span>
                    <Button onClick={addCodeSnippet} variant="ghost" size="sm" className="h-7 text-xs">
                      <Plus className="w-3 h-3 mr-1" />
                      Add Snippet
                    </Button>
                  </div>

                  {codeSnippets.map((snippet, index) => (
                    <div key={snippet.id} className="bg-card rounded-lg border border-border overflow-hidden">
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
                          <span className="text-sm font-mono text-primary">[{snippet.id}]</span>
                          <select
                            value={snippet.language}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateSnippet(snippet.id, { language: e.target.value });
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 px-2 rounded bg-secondary border-none text-xs text-muted-foreground focus:outline-none"
                          >
                            {LANGUAGES.map(lang => (
                              <option key={lang.value} value={lang.value}>{lang.label}</option>
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
                            onChange={(value) => updateSnippet(snippet.id, { code: value })}
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
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-sm mb-4">Select a note or create a new one</p>
              <Button onClick={handleCreateNote} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Note
              </Button>
            </div>
          </div>
        )}
      </div>
      
      <PasswordDialog
        open={isPasswordDialogOpen}
        onOpenChange={setIsPasswordDialogOpen}
        onConfirm={async (password: string) => {
          try {
            await passwordAction(password);
          } catch (error) {
            console.error('Action failed:', error);
            toast.error('Operation failed. Please try again.');
          }
        }}
      />
    </div>
  );
};