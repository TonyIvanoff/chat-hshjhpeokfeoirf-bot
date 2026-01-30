import { useDrag } from "react-dnd";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { TableLayerData } from "@/types/editor";

interface TableLayerProps extends TableLayerData {
    scale?: number;
    isSelected?: boolean;
    onSelect?: (id: string | null) => void;
    onChange?: (id: string, updates: Partial<TableLayerData>) => void;
    // Add resize support
    onResize?: (id: string, width: number, height: number) => void;
}

export function TableLayer({
    id, x, y, width, height, rotation, z,
    rows, cols, data, showBorders, borderColor,
    isSelected, onSelect, onChange, onResize
}: TableLayerProps) {
    const ref = useRef<HTMLDivElement>(null);

    const [{ isDragging }, drag] = useDrag({
        type: "TABLE_LAYER",
        item: { id, type: 'table' },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    drag(ref);

    const handleCellChange = (rIndex: number, cIndex: number, value: string) => {
        if (!onChange) return;
        const newData = [...data];
        if (!newData[rIndex]) newData[rIndex] = [];
        newData[rIndex][cIndex] = value;
        onChange(id, { data: newData }); // Propagate change
    };

    // Resize Handle Logic
    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = width;
        const startHeight = height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;
            // Propagate resize
            onResize?.(id, Math.max(50, startWidth + deltaX), Math.max(50, startHeight + deltaY));
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
            ref={ref}
            onClick={(e) => {
                e.stopPropagation();
                onSelect?.(id);
            }}
            style={{
                position: "absolute",
                left: x,
                top: y,
                width: width,
                height: height,
                transform: `rotate(${rotation || 0}deg)`,
                zIndex: z,
                opacity: isDragging ? 0.5 : 1,
            }}
            className={cn(
                "group cursor-move transition-all overflow-visible", // Changed to overflow-visible to show resize handle
                isSelected ? "ring-2 ring-blue-500 ring-offset-2" : ""
            )}
        >
            <div className="w-full h-full relative overflow-hidden">
                <table className="w-full h-full border-collapse table-fixed bg-white shadow-sm" style={{
                    borderColor: borderColor || '#000',
                    borderWidth: showBorders ? '1px' : '0'
                }}>
                    <tbody>
                        {Array.from({ length: rows }).map((_, rIndex) => (
                            <tr key={rIndex}>
                                {Array.from({ length: cols }).map((_, cIndex) => (
                                    <td
                                        key={cIndex}
                                        className="border p-1 relative min-w-[20px] h-[20px]"
                                        style={{
                                            borderColor: borderColor || '#000',
                                            borderWidth: showBorders ? '1px' : '0',
                                            borderStyle: 'solid'
                                        }}
                                    >
                                        <input
                                            className="w-full h-full bg-transparent border-none outline-none text-sm p-0 m-0 resize-none font-sans"
                                            value={data[rIndex]?.[cIndex] || ""}
                                            onChange={(e) => handleCellChange(rIndex, cIndex, e.target.value)}
                                            onMouseDown={(e) => e.stopPropagation()} // Allow content edit without dragging
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Resize Handle */}
            {isSelected && onResize && (
                <div
                    className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-blue-500 cursor-se-resize z-50 rounded-full shadow-sm"
                    onMouseDown={handleResizeStart}
                />
            )}
        </div>
    );
}
