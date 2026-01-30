import { ImageLayerData } from "@/types/editor";
import { cn } from "@/lib/utils";

interface ImageLayerProps extends ImageLayerData {
    scale?: number;
    isSelected?: boolean;
    rotate?: number;   // Added
    opacity?: number;  // Added (already in Data but good to be explicit if destructuring)
    onSelect?: (id: string | null) => void;
    onMove?: (id: string, x: number, y: number) => void;
    onResize?: (id: string, width: number, height: number) => void;
}

export function ImageLayer({
    id, x, y, width, height, src, opacity, rotate,
    scale,
    isSelected, onSelect, onMove
}: ImageLayerProps) {

    // Custom Drag Logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if (!onMove) return;
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const initialX = x;
        const initialY = y;

        onSelect?.(id);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            // Adjust delta by scale
            const scaledDeltaX = deltaX / (scale || 1);
            const scaledDeltaY = deltaY / (scale || 1);

            onMove(id, Math.round(initialX + scaledDeltaX), Math.round(initialY + scaledDeltaY));
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            onMouseDown={handleMouseDown}
            onClick={(e) => {
                e.stopPropagation();
                onSelect?.(id);
            }}
            className={cn(
                "absolute group cursor-move transition-all z-10 select-none",
                isSelected && "ring-2 ring-blue-500 z-30"
            )}
            style={{
                left: x,
                top: y,
                width: width,
                height: height,
                transform: rotate ? `rotate(${rotate}deg)` : 'none',
                opacity: opacity ?? 1
            }}
        >
            <img
                src={src}
                alt="Layer"
                className="w-full h-full object-fill pointer-events-none select-none"
                style={{ backgroundColor: 'transparent' }}
            />
            {/* Hover indication */}
            <div className="absolute inset-0 hover:ring-1 hover:ring-blue-400 pointer-events-none rounded sm" />
        </div>
    );
}
