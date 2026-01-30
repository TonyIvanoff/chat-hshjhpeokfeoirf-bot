
import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface FontSelectProps {
    value: string;
    fonts: string[];
    onChange: (font: string) => void;
}

export function FontSelect({ value, fonts, onChange }: FontSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredFonts = fonts.filter(font =>
        font.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 text-sm bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-colors focus:ring-2 focus:ring-blue-500/20 outline-none"
            >
                <span className="truncate flex-1 text-left">{value}</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[60] max-h-80 flex flex-col animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-slate-100">
                        <div className="relative">
                            <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search fonts..."
                                className="w-full pl-7 pr-2 py-1 text-xs border rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-1 custom-scrollbar">
                        {filteredFonts.map((font) => (
                            <button
                                key={font}
                                onClick={() => {
                                    onChange(font);
                                    setIsOpen(false);
                                }}
                                className={cn(
                                    "w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md transition-colors group",
                                    value === font ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-700"
                                )}
                            >
                                <span className="truncate mr-4">{font}</span>
                                {/* Preview "Thumbnail" on the right */}
                                <span
                                    className="text-lg opacity-80"
                                    style={{ fontFamily: font }}
                                >
                                    Aa
                                </span>
                            </button>
                        ))}
                        {filteredFonts.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-400">
                                No fonts found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
