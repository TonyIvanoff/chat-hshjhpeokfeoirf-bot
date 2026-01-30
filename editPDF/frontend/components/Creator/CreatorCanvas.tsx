"use client";

import { useState } from "react";
import { useDrop } from "react-dnd";
import { cn } from "@/lib/utils";

interface FormElement {
    id: string;
    type: string;
    label: string;
    x: number;
    y: number;
}

export function CreatorCanvas() {
    const [elements, setElements] = useState<FormElement[]>([]);

    const [{ isOver }, drop] = useDrop(() => ({
        accept: "FORM_ELEMENT",
        drop: (item: { type: string; label: string }, monitor) => {
            const offset = monitor.getClientOffset();
            const dropTarget = document.getElementById("pdf-canvas");
            // Calculate relative position (very basic for now)
            if (offset && dropTarget) {
                const rect = dropTarget.getBoundingClientRect();
                const x = offset.x - rect.left;
                const y = offset.y - rect.top;

                addElement(item.type, item.label, x, y);
            }
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
        }),
    }));

    const addElement = (type: string, label: string, x: number, y: number) => {
        setElements((prev) => [
            ...prev,
            { id: Math.random().toString(36).substr(2, 9), type, label, x, y },
        ]);
    };

    const dropRef = (node: HTMLDivElement | null) => {
        drop(node);
    };

    return (
        <div
            id="pdf-canvas"
            ref={dropRef}
            className={cn(
                "w-[595px] h-[842px] bg-white shadow-xl relative transition-all", // A4 Size relative
                isOver && "ring-4 ring-blue-400/50"
            )}
        >
            {/* Grid Lines (Optional) */}
            <div className="absolute inset-0 pointer-events-none opacity-10"
                style={{ backgroundImage: "radial-gradient(#000 1px, transparent 1px)", backgroundSize: "20px 20px" }}
            />

            {elements.map((el) => (
                <div
                    key={el.id}
                    style={{ left: el.x, top: el.y }}
                    className="absolute p-2 bg-blue-100/80 border border-blue-400 rounded text-xs font-medium text-blue-700 cursor-move shadow-sm"
                >
                    {el.label}
                </div>
            ))}

            {elements.length === 0 && !isOver && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-300 pointer-events-none">
                    Drag elements here to build your form
                </div>
            )}
        </div>
    );
}
