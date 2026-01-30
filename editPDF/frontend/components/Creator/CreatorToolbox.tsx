"use client";

import { Type, CheckSquare, CircleDot, MousePointerClick, Image as ImageIcon, PenTool } from "lucide-react";
import { ToolboxItem } from "./ToolboxItem";

export function CreatorToolbox() {
    return (
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-6 h-full">
            <div>
                <h3 className="font-semibold text-slate-700 mb-4 px-2">Form Elements</h3>
                <div className="flex flex-col gap-3">
                    <ToolboxItem type="text" label="Text Field" icon={Type} />
                    <ToolboxItem type="checkbox" label="Checkbox" icon={CheckSquare} />
                    <ToolboxItem type="radio" label="Radio Group" icon={CircleDot} />
                    <ToolboxItem type="button" label="Button" icon={MousePointerClick} />
                </div>
            </div>

            <div>
                <h3 className="font-semibold text-slate-700 mb-4 px-2">Media & Sign</h3>
                <div className="flex flex-col gap-3">
                    <ToolboxItem type="image" label="Image Placeholder" icon={ImageIcon} />
                    <ToolboxItem type="signature" label="Signature Field" icon={PenTool} />
                </div>
            </div>
        </div>
    );
}
