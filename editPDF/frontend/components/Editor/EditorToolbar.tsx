"use client";

import { Editor } from "@tiptap/react";
import {
    Bold, Italic, Underline, Strikethrough,
    AlignLeft, AlignCenter, AlignRight,
    List, ListOrdered,
    Superscript, Subscript,
    Highlighter,
    Undo, Redo
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolbarProps {
    editor: Editor | null;
}

// Helper type to work around tiptap extension typing limitations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EditorCommands = any;

export function EditorToolbar({ editor }: ToolbarProps) {
    if (!editor) return null;

    // Cast chain commands to avoid TypeScript errors with extension methods
    const cmd = (): EditorCommands => editor.chain().focus();

    const ToggleButton = ({
        active,
        onClick,
        icon: Icon,
        title
    }: { active?: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; title: string }) => (
        <button
            onClick={onClick}
            title={title}
            className={cn(
                "p-2 rounded-lg transition-colors hover:bg-white/50 text-slate-700",
                active && "bg-blue-100 text-blue-700"
            )}
        >
            <Icon className="w-4 h-4" />
        </button>
    );

    return (
        <div className="flex flex-wrap items-center gap-1 p-2 mb-4 glass-panel rounded-xl bg-white/40">
            {/* History */}
            <div className="flex items-center gap-1 border-r border-slate-300/50 pr-2 mr-1">
                <ToggleButton onClick={() => cmd().undo().run()} icon={Undo} title="Undo" />
                <ToggleButton onClick={() => cmd().redo().run()} icon={Redo} title="Redo" />
            </div>

            {/* Basic Formatting */}
            <div className="flex items-center gap-1 border-r border-slate-300/50 pr-2 mr-1">
                <ToggleButton
                    onClick={() => cmd().toggleBold().run()}
                    active={editor.isActive("bold")}
                    icon={Bold}
                    title="Bold"
                />
                <ToggleButton
                    onClick={() => cmd().toggleItalic().run()}
                    active={editor.isActive("italic")}
                    icon={Italic}
                    title="Italic"
                />
                <ToggleButton
                    onClick={() => cmd().toggleUnderline().run()}
                    active={editor.isActive("underline")}
                    icon={Underline}
                    title="Underline"
                />
                <ToggleButton
                    onClick={() => cmd().toggleStrike().run()}
                    active={editor.isActive("strike")}
                    icon={Strikethrough}
                    title="Strikethrough"
                />
            </div>

            {/* Script & Highlight */}
            <div className="flex items-center gap-1 border-r border-slate-300/50 pr-2 mr-1">
                <ToggleButton
                    onClick={() => cmd().toggleSuperscript().run()}
                    active={editor.isActive("superscript")}
                    icon={Superscript}
                    title="Superscript"
                />
                <ToggleButton
                    onClick={() => cmd().toggleSubscript().run()}
                    active={editor.isActive("subscript")}
                    icon={Subscript}
                    title="Subscript"
                />
                <ToggleButton
                    onClick={() => cmd().toggleHighlight().run()}
                    active={editor.isActive("highlight")}
                    icon={Highlighter}
                    title="Highlight"
                />
            </div>

            {/* Alignment */}
            <div className="flex items-center gap-1 border-r border-slate-300/50 pr-2 mr-1">
                <ToggleButton
                    onClick={() => cmd().setTextAlign('left').run()}
                    active={editor.isActive({ textAlign: 'left' })}
                    icon={AlignLeft}
                    title="Align Left"
                />
                <ToggleButton
                    onClick={() => cmd().setTextAlign('center').run()}
                    active={editor.isActive({ textAlign: 'center' })}
                    icon={AlignCenter}
                    title="Align Center"
                />
                <ToggleButton
                    onClick={() => cmd().setTextAlign('right').run()}
                    active={editor.isActive({ textAlign: 'right' })}
                    icon={AlignRight}
                    title="Align Right"
                />
            </div>

            {/* Lists */}
            <div className="flex items-center gap-1">
                <ToggleButton
                    onClick={() => cmd().toggleBulletList().run()}
                    active={editor.isActive("bulletList")}
                    icon={List}
                    title="Bullet List"
                />
                <ToggleButton
                    onClick={() => cmd().toggleOrderedList().run()}
                    active={editor.isActive("orderedList")}
                    icon={ListOrdered}
                    title="Numbered List"
                />
            </div>
        </div>
    );
}
