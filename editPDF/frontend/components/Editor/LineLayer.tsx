"use client";

import { useRef } from "react";
import { LineLayerData } from "@/types/editor";
import { cn } from "@/lib/utils";

interface LineLayerProps extends LineLayerData {
    scale?: number;
    isSelected?: boolean;
    onSelect?: (id: string | null) => void;
    onMove?: (id: string, x: number, y: number) => void;
    onResize?: (id: string, width: number, height: number) => void;
}

export function LineLayer({
    id,
    x,
    y,
    width,
    height,
    strokeColor = "#000000",
    strokeWidth = 2,
    lineRotation = 0,
    scale = 1,
    isSelected,
    onSelect,
    onMove,
    onResize,
}: LineLayerProps) {
    const dragRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect?.(id);
    };

    // Custom drag handling
    const handleDragStart = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!onMove) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const initX = x;
        const initY = y;

        const handleMouseMove = (ev: MouseEvent) => {
            const dx = (ev.clientX - startX) / scale;
            const dy = (ev.clientY - startY) / scale;
            onMove(id, Math.round(initX + dx), Math.round(initY + dy));
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Resize handler
    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!onResize) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const initWidth = width;
        const initHeight = height;

        const handleMouseMove = (ev: MouseEvent) => {
            const dx = (ev.clientX - startX) / scale;
            const dy = (ev.clientY - startY) / scale;
            // For line, only resize in the direction of the line
            if (lineRotation === 0) {
                onResize(id, Math.max(20, initWidth + dx), strokeWidth);
            } else {
                onResize(id, strokeWidth, Math.max(20, initHeight + dy));
            }
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    // Determine dimensions based on rotation
    const displayWidth = lineRotation === 0 ? width : strokeWidth;
    const displayHeight = lineRotation === 0 ? strokeWidth : height;

    return (
        <div
            ref={dragRef}
            onClick={handleClick}
            onMouseDown={handleDragStart}
            className={cn(
                "absolute cursor-move hover:ring-2 hover:ring-blue-400 transition-all z-20 group",
                isSelected && "ring-2 ring-blue-500 z-30"
            )}
            style={{
                left: x,
                top: y,
                width: displayWidth,
                height: displayHeight,
                backgroundColor: strokeColor,
                borderRadius: strokeWidth / 2,
            }}
        >
            {/* Resize Handle */}
            {isSelected && onResize && (
                <div
                    className={cn(
                        "absolute w-4 h-4 bg-white border-2 border-blue-500 cursor-pointer z-50 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform",
                        lineRotation === 0 ? "-right-2 top-1/2 -translate-y-1/2 cursor-e-resize" : "-bottom-2 left-1/2 -translate-x-1/2 cursor-s-resize"
                    )}
                    onMouseDown={handleResizeStart}
                >
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                </div>
            )}
        </div>
    );
}
