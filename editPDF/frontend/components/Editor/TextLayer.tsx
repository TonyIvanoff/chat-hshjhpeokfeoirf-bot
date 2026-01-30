"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TextLayerData } from "@/types/editor";

interface TextLayerProps extends TextLayerData {
    w: number;
    h: number;
    scale?: number; // Added
    isSelected?: boolean;
    onSelect?: (id: string | null) => void;
    onChange: (id: string, newText: string) => void;
    onMove: (id: string, x: number, y: number) => void;
    // We add onResize prop to propagate resize events
    onResize?: (id: string, width: number, height: number) => void;
}

export function TextLayer({
    id, x, y, w, h, text, align, listStyle,
    fontFamily, fontSize, color, fontWeight, fontStyle, textDecoration, backgroundColor,
    lineHeight, letterSpacing, opacity, borderRadius, boxShadow, noWrap, verticalAlign,
    scale, // Destructure scale
    isSelected, onSelect, onChange, onMove, onResize
}: TextLayerProps) {
    // ... hooks ...
    const [isEditing, setIsEditing] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const dragRef = useRef<HTMLDivElement>(null);

    // REMOVED useDrag hook

    // drag(dragRef); // Removed logic

    useEffect(() => {
        if (!isSelected) {
            setIsEditing(false);
        }
    }, [isSelected]);

    useEffect(() => {
        if (isEditing && textAreaRef.current) {
            textAreaRef.current.focus();
            textAreaRef.current.setSelectionRange(textAreaRef.current.value.length, textAreaRef.current.value.length);
        }
    }, [isEditing]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
    };

    // Add click handler to select
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect?.(id);
    };

    // Custom Drag Logic (replaces useDrag)
    const handleDragStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        // Don't drag if editing
        if (isEditing) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const initialX = x;
        const initialY = y;

        // Notify selection
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

    // Resize Handle Logic
    const handleResizeStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = w;
        const startHeight = h;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            // Adjust resize by scale too
            const scaledDeltaX = deltaX / (scale || 1);
            const scaledDeltaY = deltaY / (scale || 1);

            onResize?.(id, Math.max(20, startWidth + scaledDeltaX), Math.max(20, startHeight + scaledDeltaY));
        };

        const handleMouseUp = () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const commonStyles: React.CSSProperties = {
        fontFamily: fontFamily || 'Arial',
        fontSize: `${fontSize || 16}px`,
        color: color || '#000000',
        fontWeight: fontWeight || 'normal',
        fontStyle: fontStyle || 'normal',
        textDecoration: textDecoration || 'none',
        textAlign: align || 'left',
        backgroundColor: backgroundColor || 'transparent',
        lineHeight: lineHeight || 1.2,
        letterSpacing: `${letterSpacing || 0}px`,
        opacity: opacity ?? 1,
        borderRadius: `${borderRadius || 0}px`,
        boxShadow: boxShadow || 'none',
    };

    if (isEditing) {
        return (
            <div
                style={{
                    position: "absolute",
                    left: x,
                    top: y,
                    width: w,
                    height: h,
                    zIndex: 100 // Higher z-index while editing
                }}
                className="group"
            >
                <textarea
                    ref={textAreaRef}
                    value={text}
                    onChange={(e) => onChange(id, e.target.value)}
                    onBlur={handleBlur}
                    style={{
                        ...commonStyles,
                        width: '100%',
                        height: '100%',
                        resize: 'none',
                        outline: '2px solid #3b82f6',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        overflow: 'hidden',
                        background: 'white' // Opaque background while editing usually better
                    }}
                    onKeyDown={(e) => {
                        // Only block/blur on Enter if we are in single-line mode (noWrap=true)
                        if (e.key === 'Enter' && noWrap) {
                            e.preventDefault();
                            e.currentTarget.blur();
                        }
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onSelect={(e) => e.stopPropagation()} // Prevent selection event bubbling
                />
            </div>
        );
    }

    return (
        <div
            ref={dragRef}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleDragStart} // CUSTOM DRAG
            className={cn(
                "absolute group cursor-move hover:ring-1 hover:ring-blue-400 p-1 rounded transition-all z-20 select-none",
                // ALWAYS visible dashed border (editor aid), lighter when not hovered
                "border-[2px] border-dashed border-slate-300 hover:border-slate-400",
                isSelected && "ring-2 ring-blue-500 bg-blue-50/20 z-30"
            )}
            style={{
                left: x,
                top: y,
                width: w,
                height: h,
                // whiteSpace: "pre", // Moved to inner
                // overflow: "visible", // Moved to inner
                ...commonStyles,
                userSelect: 'none',
                display: 'flex', // Flex to handle marker + content
                alignItems: 'flex-start',
                paddingLeft: (listStyle && listStyle !== 'none') ? '8px' : '0px',
            }}
        >
            {/* Render content based on list style or plain text */}
            {(listStyle === 'disc' || listStyle === 'decimal') ? (
                <div className="flex-1 min-w-0">
                    {text.split('\n').map((line, i) => (
                        <div key={i} className="flex items-start" style={{ marginBottom: lineHeight ? `${(lineHeight - 1) * 0.5}em` : '4px' }}>
                            <span
                                className="mr-1 mt-[2px] shrink-0 font-medium text-xs select-none min-w-[12px] text-right"
                                style={{ color: color || '#000000' }}
                            >
                                {listStyle === 'disc' ? '•' : `${i + 1}.`}
                            </span>
                            <div style={{ whiteSpace: noWrap ? "nowrap" : "pre-wrap", overflowWrap: noWrap ? "normal" : "break-word", flex: 1 }}>
                                {line || <br />} {/* Render br for empty lines to keep height */}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-1" style={{
                    whiteSpace: noWrap ? "nowrap" : "pre-wrap",
                    overflowWrap: noWrap ? "normal" : "break-word",
                    verticalAlign: verticalAlign || 'baseline',
                    fontSize: (verticalAlign === 'sub' || verticalAlign === 'super') ? '0.8em' : undefined,
                    lineHeight: (verticalAlign === 'sub' || verticalAlign === 'super') ? '1' : undefined,
                    transform: verticalAlign === 'super' ? 'translateY(-0.3em)' : verticalAlign === 'sub' ? 'translateY(0.3em)' : 'none',
                    display: 'inline-block' // Needed for transform
                }}>
                    {text}
                </div>
            )}

            {/* Resize Handle - Bigger for easier grabbing */}
            {isSelected && onResize && (
                <div
                    className="absolute -bottom-2 -right-2 w-6 h-6 bg-white border-2 border-blue-500 cursor-se-resize z-50 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform"
                    onMouseDown={handleResizeStart}
                >
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                </div>
            )}
        </div>
    );
}
