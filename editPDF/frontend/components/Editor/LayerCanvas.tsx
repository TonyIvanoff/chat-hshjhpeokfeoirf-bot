"use client";

import { useState, useRef, useEffect } from "react";
import { useDrop } from "react-dnd";
import { TextLayer } from "./TextLayer";
import { ImageLayer } from "./ImageLayer";
import { PathLayer } from "./PathLayer";
import { ImagePlaceholderLayer } from "./ImagePlaceholderLayer";
import { TableLayer } from "./TableLayer";
import { LineLayer } from "./LineLayer";
import { Layer } from "@/types/editor";

interface LayerCanvasProps {
    initialLayers: Layer[];
    width: number;
    height: number;
    scale?: number;
    rotate?: number;
    selectedLayerId?: string | null;
    onLayerSelect?: (id: string | null) => void;
    onLayersChange?: (layers: Layer[]) => void;
    onAddLayer?: (type: string, payload?: any) => void;
}

export function LayerCanvas({ initialLayers, width, height, scale = 1, rotate = 0, selectedLayerId, onLayerSelect, onLayersChange, onAddLayer }: LayerCanvasProps) {
    const [layers, setLayers] = useState<Layer[]>(initialLayers || []);

    // Sync layers from parent when initialLayers prop changes.
    // This design allows parent (PDFEditor) to be the source of truth while
    // LayerCanvas provides optimistic local updates for smooth drag/edit UX.
    // Any parent state change resets local state to maintain consistency.
    useEffect(() => {
        setLayers(initialLayers || []);
    }, [initialLayers]);

    const containerRef = useRef<HTMLDivElement>(null);
    const [, dropRef] = useDrop({
        accept: ["TEXT_LAYER", "IMAGE_LAYER", "PATH_LAYER", "PLACEHOLDER_LAYER", "TABLE_LAYER", "NEW_TEXT_LAYER"],
        drop: (item: any, monitor) => {
            // Handle Dropping NEW Layer
            if (item.type === 'NEW_TEXT_LAYER' && onAddLayer) {
                const clientOffset = monitor.getClientOffset();
                if (clientOffset && containerRef.current) {
                    const rect = containerRef.current.getBoundingClientRect();
                    const x = (clientOffset.x - rect.left) / scale;
                    const y = (clientOffset.y - rect.top) / scale;

                    onAddLayer('text', {
                        x, y,
                        ...item.payload
                    });
                }
                return;
            }

            // Handle Moving Existing Layer
            const delta = monitor.getDifferenceFromInitialOffset();
            if (delta && item.id) {
                const layer = layers.find(l => l.id === item.id);
                if (layer) {
                    // Account for scale in movement
                    const newX = Math.round(layer.x + (delta.x / scale));
                    const newY = Math.round(layer.y + (delta.y / scale));
                    moveLayer(layer.id, newX, newY);
                }
            }
        },
    });

    // Handle Layer Move
    const moveLayer = (id: string, x: number, y: number) => {
        const next = layers.map(l => l.id === id ? { ...l, x, y } : l);
        setLayers(next);
        onLayersChange?.(next);
    };

    const updateText = (id: string, text: string) => {
        const next = layers.map(l => (l.id === id && l.type === 'text') ? { ...l, text } : l);
        setLayers(next);
        onLayersChange?.(next);
    };

    const updateLayerData = (id: string, updates: any) => {
        const next = layers.map(l => l.id === id ? { ...l, ...updates } : l);
        setLayers(next);
        onLayersChange?.(next);
    };

    const handleResize = (id: string, width: number, height: number) => {
        updateLayerData(id, { width, height });
    };

    const handlePlaceholderUpload = (id: string, file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const src = e.target?.result as string;
            // TRANSFORM placeholder -> image layer
            const next = layers.map(l => l.id === id ? {
                ...l,
                type: 'image' as const, // Force type change
                src,
                opacity: 1
            } : l);
            setLayers(next);
            onLayersChange?.(next);
        };
        reader.readAsDataURL(file);
    };

    // Visual dimensions
    const isRotated = rotate % 180 !== 0;
    const visualWidth = isRotated ? height : width;
    const visualHeight = isRotated ? width : height;

    return (
        <div
            ref={dropRef as any}
            className="w-full min-h-full flex p-8 bg-slate-200/50 cursor-default overflow-visible"
            onClick={(e) => {
                // Only deselect if clicking the canvas background itself
                if (e.target === e.currentTarget) {
                    onLayerSelect?.(null);
                }
            }}
        >
            {/* Shim to force scrollbars if zoomed/rotated */}
            <div
                style={{
                    width: visualWidth * scale,
                    height: visualHeight * scale,
                    minWidth: 'min-content',
                    minHeight: 'min-content',
                    flexShrink: 0,
                    margin: 'auto' // CRITICAL: This allows centering while preserving scroll
                }}
                className="relative flex items-center justify-center"
            >
                <div
                    className="relative bg-white shadow-2xl origin-center shrink-0 overflow-hidden"
                    ref={containerRef}
                    style={{
                        width: `${width}px`,
                        height: `${height}px`,
                        transform: `scale(${scale}) rotate(${rotate}deg)`,
                        transition: 'transform 0.3s ease-in-out',
                        outline: '1px solid rgba(0,0,0,0.1)'
                    }}
                >


                    {(layers || []).map(layer => {
                        if (layer.hidden) return null;

                        if (layer.type === 'text') {
                            // Handle legacy style object if present from backend
                            const style = (layer as any).style || {};

                            return (
                                <TextLayer
                                    key={layer.id}
                                    {...layer}
                                    w={layer.width}
                                    h={layer.height}
                                    scale={scale} // Pass scale
                                    // Fallback to style object if flat prop is missing
                                    fontSize={layer.fontSize ?? style.fontSize}
                                    fontFamily={layer.fontFamily ?? style.fontFamily}
                                    color={layer.color ?? style.color}
                                    fontWeight={layer.fontWeight ?? style.fontWeight}
                                    fontStyle={layer.fontStyle ?? style.fontStyle}
                                    textDecoration={layer.textDecoration ?? style.textDecoration}
                                    backgroundColor={layer.backgroundColor ?? style.backgroundColor}

                                    align={layer.align}
                                    listStyle={layer.listStyle}
                                    isSelected={layer.id === selectedLayerId}
                                    onSelect={onLayerSelect}
                                    onChange={updateText}
                                    onMove={moveLayer}
                                    onResize={handleResize}
                                />
                            );
                        } else if (layer.type === 'image') {
                            return (
                                <ImageLayer
                                    key={layer.id}
                                    {...layer}
                                    scale={scale} // Pass scale
                                    isSelected={layer.id === selectedLayerId}
                                    onSelect={onLayerSelect}
                                    onMove={moveLayer} // ADDED
                                />
                            );
                        } else if (layer.type === 'placeholder') {
                            return (
                                <ImagePlaceholderLayer
                                    key={layer.id}
                                    {...layer}
                                    scale={scale} // Pass scale
                                    isSelected={layer.id === selectedLayerId}
                                    onSelect={onLayerSelect}
                                    onUpload={handlePlaceholderUpload}
                                />
                            );
                        } else if (layer.type === 'table') {
                            return (
                                <TableLayer
                                    key={layer.id}
                                    {...layer}
                                    scale={scale} // Pass scale
                                    isSelected={layer.id === selectedLayerId}
                                    onSelect={onLayerSelect}
                                    onChange={updateLayerData}
                                    onResize={handleResize}
                                />
                            );
                        } else if (layer.type === 'path') {
                            return (
                                <PathLayer
                                    key={layer.id}
                                    {...layer}
                                    scale={scale}
                                    isSelected={layer.id === selectedLayerId}
                                    onSelect={onLayerSelect}
                                    onMove={moveLayer}
                                />
                            );
                        } else if (layer.type === 'line') {
                            return (
                                <LineLayer
                                    key={layer.id}
                                    {...layer}
                                    scale={scale}
                                    isSelected={layer.id === selectedLayerId}
                                    onSelect={onLayerSelect}
                                    onMove={moveLayer}
                                    onResize={handleResize}
                                />
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
}
