import { FileText, Image as ImageIcon, PenTool, Save } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Header() {
    return (
        <header className="h-20 flex items-center justify-between px-6 border-b border-white/20 bg-white/30 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-2">
                <div className="bg-blue-500/20 p-2 rounded-lg">
                    <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                    Live PDF Editor
                </h1>
            </div>

            <div className="flex items-center gap-4">
                <nav className="flex gap-1 bg-white/20 p-1 rounded-xl border border-white/30">
                    <Link href="/" className="px-4 py-1.5 rounded-lg bg-white/50 shadow-sm text-sm font-medium text-slate-800">
                        Editor
                    </Link>
                    <Link href="/creator" className="px-4 py-1.5 rounded-lg hover:bg-white/30 text-sm font-medium text-slate-600 transition-colors">
                        Creator
                    </Link>
                </nav>
            </div>

            <div className="flex items-center gap-2">
                <button className="glass-button px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Save className="w-4 h-4" />
                    Save Project
                </button>
            </div>
        </header>
    );
}
