"use client";

import { useDrag } from "react-dnd";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolboxItemProps {
    type: string;
    label: string;
    icon: LucideIcon;
}

export function ToolboxItem({ type, label, icon: Icon }: ToolboxItemProps) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: "FORM_ELEMENT",
        item: { type, label },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }));

    // Attach drag ref to the DOM element
    const dragRef = (node: HTMLDivElement | null) => {
        drag(node);
    };

    return (
        <div
            ref={dragRef}
            className={cn(
                "flex items-center gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm cursor-move transition-all hover:shadow-md hover:border-blue-300",
                isDragging && "opacity-50"
            )}
        >
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Icon className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
    );
}
