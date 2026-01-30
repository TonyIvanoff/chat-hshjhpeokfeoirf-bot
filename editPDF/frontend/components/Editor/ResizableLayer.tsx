"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface ResizableLayerProps {
    id: string;
    width: number;
    height: number;
    isSelected: boolean;
    onResize: (id: string, width: number, height: number) => void;
    children: React.ReactNode;
}

export function ResizableLayer({ id, width, height, isSelected, onResize, children }: ResizableLayerProps) {
    const [isResizing, setIsResizing] = useState(false);

    // Resize handler
    const handleResizeStart = (e: React.MouseEvent, direction: string) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            let newWidth = startWidth;
            let newHeight = startHeight;

            if (direction.includes('e')) newWidth = startWidth + deltaX;
            if (direction.includes('w')) newWidth = startWidth - deltaX; // Logic for left resize is harder without x/y change, let's stick to SE for now or implement full logic
            if (direction.includes('s')) newHeight = startHeight + deltaY;
            if (direction.includes('n')) newHeight = startHeight - deltaY;

            // Simple SE resize for now to match request "dragging the corner"
            // For full multi-direction, we need to update X/Y too which is handled by parent moveLayer.
            // Let's implement SE (Bottom-Right) first as it's the standard/primary one requested. 
            // If user wants corners, we can just do SE. 
            // Prompt says "dragging the corner". usually means SE.

            if (direction === 'se') {
                onResize(id, Math.max(20, startWidth + deltaX), Math.max(20, startHeight + deltaY));
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className="relative"
            style={{ width, height }}
        >
            {children}

            {isSelected && (
                <>
                    {/* Border highlight */}
                    <div className="absolute inset-0 border border-blue-500 pointer-events-none z-40" />

                    {/* Resize Handle (SE) */}
                    <div
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-blue-500 cursor-se-resize z-50 rounded-full shadow-sm"
                        onMouseDown={(e) => handleResizeStart(e, 'se')}
                    />
                </>
            )}
        </div>
    );
}
