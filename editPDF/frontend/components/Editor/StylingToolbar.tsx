"use client";

import { Bold, Italic, Type, Palette, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface StylingToolbarProps {
    selectedLayer: any | null;
    onUpdateStyle: (style: any) => void;
}

const FONT_FAMILIES = ["Arial", "Times New Roman", "Courier New", "Roboto", "Lato", "Montserrat"];
const COLORS = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#FFFFFF"];

export function StylingToolbar({ selectedLayer, onUpdateStyle }: StylingToolbarProps) {
    if (!selectedLayer) {
        return (
            <div className="w-16 flex flex-col items-center py-4 bg-white/40 border-l border-white/20 backdrop-blur-md">
                <span className="text-xs text-slate-400 rotate-90 mt-10 whitespace-nowrap">Select Text</span>
            </div>
        );
    }

    const style = selectedLayer.style || {};

    const handleStyleChange = (key: string, value: any) => {
        onUpdateStyle({ ...style, [key]: value });
    };

    return (
        <div className="w-64 flex flex-col bg-white/80 border-l border-slate-200/50 backdrop-blur-xl h-full shadow-xl p-4 gap-6 overflow-y-auto">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Text Style</h3>

            {/* Font Family */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500">Font</label>
                <select
                    className="w-full text-sm p-2 rounded-md border border-slate-200 bg-white"
                    value={style.fontFamily || "Arial"}
                    onChange={(e) => handleStyleChange("fontFamily", e.target.value)}
                >
                    {FONT_FAMILIES.map(f => (
                        <option key={f} value={f}>{f}</option>
                    ))}
                </select>
            </div>

            {/* Font Size */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500">Size ({Math.round(style.fontSize || 12)}px)</label>
                <input
                    type="range"
                    min="8"
                    max="72"
                    value={style.fontSize || 12}
                    onChange={(e) => handleStyleChange("fontSize", Number(e.target.value))}
                    className="w-full accent-blue-500"
                />
            </div>

            {/* Styles */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                    onClick={() => handleStyleChange("fontWeight", style.fontWeight === "bold" ? "normal" : "bold")}
                    className={cn(
                        "p-2 rounded hover:bg-white transition-colors",
                        style.fontWeight === "bold" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"
                    )}
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    onClick={() => handleStyleChange("fontStyle", style.fontStyle === "italic" ? "normal" : "italic")}
                    className={cn(
                        "p-2 rounded hover:bg-white transition-colors",
                        style.fontStyle === "italic" ? "bg-white shadow-sm text-blue-600" : "text-slate-500"
                    )}
                >
                    <Italic className="w-4 h-4" />
                </button>
            </div>

            {/* Colors */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500">Color</label>
                <div className="grid grid-cols-5 gap-2">
                    {COLORS.map(c => (
                        <button
                            key={c}
                            onClick={() => handleStyleChange("color", c)}
                            className={cn(
                                "w-6 h-6 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110",
                                style.color === c ? "ring-2 ring-offset-1 ring-blue-500" : ""
                            )}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <input
                        type="color"
                        value={style.color || "#000000"}
                        onChange={(e) => handleStyleChange("color", e.target.value)}
                        className="w-6 h-6 bg-transparent border-0 p-0 rounded-full overflow-hidden cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );
}
