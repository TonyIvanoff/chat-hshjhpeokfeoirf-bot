"use client";

import { useDrag } from "react-dnd";
import { cn } from "@/lib/utils";
import { PathLayerData } from "@/types/editor";

interface PathLayerProps extends PathLayerData {
    scale?: number;
    isSelected?: boolean;
    onSelect?: (id: string) => void;
    onMove?: (id: string, x: number, y: number) => void;
}

export function PathLayer({ id, x, y, width, height, d, fill, stroke, strokeWidth, isSelected, onSelect }: PathLayerProps) {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: "PATH_LAYER",
        item: { id, x, y },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    }), [id, x, y]);

    return (
        <div
            ref={drag as any}
            onClick={(e) => {
                e.stopPropagation();
                onSelect?.(id);
            }}
            className={cn(
                "absolute group cursor-move transition-all z-10",
                isDragging ? 'opacity-50' : 'opacity-100',
                isSelected && "ring-2 ring-blue-500 z-30"
            )}
            style={{
                left: x,
                top: y,
                width: width,
                height: height,
            }}
        >
            <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${width} ${height}`}
                className="overflow-visible"
            >
                <path
                    d={d}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                />
            </svg>
            {/* Hit Area for thin paths */}
            <div className="absolute inset-0 hover:ring-1 hover:ring-blue-400 pointer-events-none" />
        </div>
    );
}
