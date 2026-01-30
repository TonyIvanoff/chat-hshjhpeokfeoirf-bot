"use client";

import { useState, useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
import {
    Bold, Italic, Type, Palette, AlignLeft, AlignCenter, AlignRight, AlignJustify, Underline, Strikethrough,
    Layers, Image as ImageIcon, Eye, EyeOff, Trash2, MousePointer2, Plus, Table as TableIcon, Square, Highlighter, List, ListOrdered, GripVertical, Check, Superscript, Subscript, Minus, RotateCw, ChevronDown, ChevronRight,
    Group, Ungroup, ArrowUp, ArrowDown, Maximize2, Minimize2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorSidebarProps {
    layers: any[];
    selectedLayerId: string | null;
    onLayerSelect: (id: string | null) => void;
    onLayerUpdate: (id: string, updates: any) => void;
    onLayerDelete: (id: string) => void;
    onAddLayer: (type: string, payload?: any) => void;
    onReorderLayers?: (layers: any[]) => void;
}

import { FONT_FAMILIES } from "@/lib/fonts";
// const FONT_FAMILIES = ["Arial", "Times New Roman", "Courier New", "Roboto", "Lato", "Montserrat"];
const COLORS = ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#FFFFFF"];
import { FontSelect } from "../ui/FontSelect";

// Draggable Layer Item Component
function DraggableLayerItem({ layer, index, isSelected, onSelect, onUpdate, onDelete, moveLayer, getLayerName }: any) {
    const ref = useRef<HTMLDivElement>(null);

    const [{ isDragging }, drag] = useDrag({
        type: 'LAYER_LIST_ITEM',
        item: { id: layer.id, index },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [, drop] = useDrop({
        accept: 'LAYER_LIST_ITEM',
        hover(item: any, monitor) {
            if (!ref.current) return;
            const dragIndex = item.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) return;

            // Determine rectangle on screen
            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = (clientOffset as any).y - hoverBoundingRect.top;

            // Dragging downwards
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            // Dragging upwards
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

            // Time to move
            moveLayer(dragIndex, hoverIndex);

            // Note: we're mutating the monitor item here!
            item.index = hoverIndex;
        },
    });

    drag(drop(ref));

    const Icon = layer.type === 'text' ? Type :
        layer.type === 'image' ? ImageIcon :
            layer.type === 'table' ? TableIcon :
                layer.type === 'placeholder' ? ImageIcon :
                    layer.type === 'line' ? Minus :
                        Square;

    return (
        <div
            ref={ref}
            onClick={() => onSelect(layer.id)}
            className={cn(
                "group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none mb-2",
                isSelected
                    ? "bg-blue-50/80 border-blue-200 shadow-sm"
                    : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50",
                isDragging ? "opacity-30" : "opacity-100"
            )}
        >
            <div className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500">
                <GripVertical className="w-4 h-4" />
            </div>

            <div className={cn(
                "p-2 rounded-lg",
                isSelected ? "bg-white text-blue-600 shadow-sm" : "bg-slate-100 text-slate-500"
            )}>
                <Icon className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
                <p className={cn(
                    "text-sm font-medium truncate",
                    isSelected ? "text-blue-700" : "text-slate-700"
                )}>
                    {getLayerName(layer, index)}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                    {layer.type === 'text'
                        ? (layer.text || "Text")
                        : layer.type === 'table' ? `${layer.rows}x${layer.cols} Table`
                            : "Object"
                    }
                </p>
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        const newHidden = !layer.hidden;
                        onUpdate(layer.id, { hidden: newHidden });
                    }}
                    className="p-1.5 hover:bg-white rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                    title={layer.hidden ? "Show" : "Hide"}
                >
                    {layer.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(layer.id);
                    }}
                    className="p-1.5 hover:bg-red-50 rounded-md text-slate-400 hover:text-red-500 transition-colors"
                    title="Delete"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}

// Draggable Tree Item Component with nesting support
function DraggableTreeItem({
    layer,
    depth,
    isSelected,
    onSelect,
    onUpdate,
    onDelete,
    getLayerName,
    getChildren,
    getDescendantIds,
    typeColors,
    onReparent
}: any) {
    const ref = useRef<HTMLDivElement>(null);
    const children = getChildren(layer.id);
    const hasChildren = children.length > 0;
    const isCollapsed = layer.collapsed;
    const colors = typeColors[layer.type] || { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'bg-slate-100 text-slate-600', text: 'text-slate-700' };

    const Icon = layer.type === 'text' ? Type :
        layer.type === 'image' ? ImageIcon :
            layer.type === 'table' ? TableIcon :
                layer.type === 'placeholder' ? ImageIcon :
                    layer.type === 'line' ? Minus : Square;

    const [{ isDragging }, drag] = useDrag({
        type: 'TREE_LAYER_ITEM',
        item: { id: layer.id, parentId: layer.parentId },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [{ isOver, canDrop }, drop] = useDrop({
        accept: 'TREE_LAYER_ITEM',
        canDrop: (item: any) => {
            try {
                // Can't drop on itself
                if (item.id === layer.id) return false;
                // Can't drop on own descendants (would create circular reference)
                const descendants = getDescendantIds(item.id);
                return !descendants.includes(layer.id);
            } catch {
                return false;
            }
        },
        drop: (item: any, monitor) => {
            if (monitor.didDrop()) return; // Already handled by a child
            // Reparent: make dragged item a child of this layer
            onReparent(item.id, layer.id);
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
            canDrop: monitor.canDrop(),
        }),
    });

    drag(drop(ref));

    return (
        <div className="mb-1.5">
            <div
                ref={ref}
                onClick={() => onSelect(layer.id)}
                className={cn(
                    "group flex items-center gap-2 py-2.5 px-3 rounded-lg border transition-all cursor-grab select-none",
                    isSelected
                        ? "bg-blue-100 border-blue-300 shadow-md ring-2 ring-blue-200"
                        : `${colors.bg} ${colors.border} hover:shadow-sm`,
                    layer.hidden && "opacity-50",
                    isDragging && "opacity-30",
                    isOver && canDrop && "ring-2 ring-green-400 bg-green-50"
                )}
                style={{ marginLeft: depth * 20 }}
            >
                {/* Drag Handle */}
                <div className="cursor-grab active:cursor-grabbing p-0.5 text-slate-300 hover:text-slate-500 flex-shrink-0">
                    <GripVertical className="w-3.5 h-3.5" />
                </div>

                {/* Collapse/Expand button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (hasChildren) {
                            onUpdate(layer.id, { collapsed: !isCollapsed });
                        }
                    }}
                    className={cn(
                        "p-1 rounded transition-colors flex-shrink-0",
                        hasChildren ? "hover:bg-white/50 text-slate-500" : "invisible"
                    )}
                >
                    {hasChildren && (isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                </button>

                {/* Layer icon with type color */}
                <div className={cn(
                    "p-1.5 rounded-md flex-shrink-0",
                    isSelected ? "bg-white text-blue-600 shadow-sm" : colors.icon
                )}>
                    <Icon className="w-3.5 h-3.5" />
                </div>

                {/* Layer name */}
                <div className="flex-1 min-w-0">
                    <p className={cn(
                        "text-sm font-medium truncate",
                        isSelected ? "text-blue-800" : colors.text
                    )}>
                        {layer.name || getLayerName(layer)}
                    </p>
                    {hasChildren && (
                        <p className="text-[9px] text-slate-400 mt-0.5">
                            {children.length} nested layer{children.length > 1 ? 's' : ''}
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const newHidden = !layer.hidden;
                            onUpdate(layer.id, { hidden: newHidden });
                            getDescendantIds(layer.id).forEach((id: string) => {
                                onUpdate(id, { hidden: newHidden });
                            });
                        }}
                        className={cn(
                            "p-1.5 rounded-md transition-colors",
                            layer.hidden
                                ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                                : "hover:bg-white/80 text-slate-400 hover:text-slate-600"
                        )}
                        title={layer.hidden ? "Show layer" : "Hide layer"}
                    >
                        {layer.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            getDescendantIds(layer.id).reverse().forEach((id: string) => {
                                onDelete(id);
                            });
                            onDelete(layer.id);
                        }}
                        className="p-1.5 hover:bg-red-100 rounded-md text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete layer"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Render children if not collapsed */}
            {hasChildren && !isCollapsed && (
                <div className="ml-4 pl-3 border-l-2 border-slate-200 mt-1">
                    {children.map((child: any) => (
                        <DraggableTreeItem
                            key={child.id}
                            layer={child}
                            depth={depth + 1}
                            isSelected={child.id === isSelected}
                            onSelect={onSelect}
                            onUpdate={onUpdate}
                            onDelete={onDelete}
                            getLayerName={getLayerName}
                            getChildren={getChildren}
                            getDescendantIds={getDescendantIds}
                            typeColors={typeColors}
                            onReparent={onReparent}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// Drop zone for making layers top-level (remove from parent)
function DropZoneForRoot({ onDrop }: { onDrop: (id: string) => void }) {
    const [{ isOver, canDrop }, drop] = useDrop({
        accept: 'TREE_LAYER_ITEM',
        drop: (item: any) => {
            if (item.parentId) { // Only trigger if dragged item has a parent
                onDrop(item.id);
            }
        },
        canDrop: (item: any) => !!item.parentId, // Only accept nested items
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    return (
        <div ref={drop as any} className={cn(
            "mb-2 py-2 px-3 rounded-lg border-2 border-dashed text-center text-xs transition-all",
            isOver && canDrop ? "border-green-400 bg-green-50 text-green-600" : "border-slate-200 text-slate-400"
        )}>
            {isOver && canDrop ? "Drop here to move to top level" : "Drag nested layers here to un-nest"}
        </div>
    );
}

// Draggable New Text Item
function DraggableNewText({ styles, onAdd, isMultiline = false }: { styles: any, onAdd: () => void, isMultiline?: boolean }) {
    const label = isMultiline ? "Add TextArea" : "Add Textbox";
    const [{ isDragging }, drag] = useDrag({
        type: 'NEW_TEXT_LAYER',
        item: {
            type: 'NEW_TEXT_LAYER',
            payload: {
                text: isMultiline ? "Your Multi-line\nText Here" : "Your Text Here",
                width: 800,
                height: isMultiline ? 400 : 200,
                fontSize: styles.fontSize || 90,
                ...styles,
                noWrap: !isMultiline
            }
        },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    return (
        <div
            ref={drag as any}
            className={cn(
                "border border-slate-300 bg-white rounded-md p-3 flex items-center justify-between cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-sm group transition-all",
                isDragging ? "opacity-50" : "opacity-100"
            )}
            onClick={onAdd} // Support Click AND Drag
        >
            <div className="flex items-center gap-3">
                {isMultiline ? <AlignLeft className="w-4 h-4 text-slate-400 group-hover:text-blue-500" /> : <Type className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />}
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">Drag or Click</span>
                <GripVertical className="w-3 h-3 text-slate-300" />
            </div>
        </div>
    );
}

export function EditorSidebar({
    layers,
    selectedLayerId,
    onLayerSelect,
    onLayerUpdate,
    onLayerDelete,
    onAddLayer,
    onReorderLayers
}: EditorSidebarProps) {
    const [activeTab, setActiveTab] = useState<"text" | "layers">("text");
    const [textMode, setTextMode] = useState(false);
    const [nextStyles, setNextStyles] = useState<any>({
        fontSize: 90, // Updated default to 90 as requested
        fontFamily: 'Arial',
        color: '#000000',
        backgroundColor: 'transparent',
        align: 'left'
    });

    const selectedLayer = layers.find(l => l.id === selectedLayerId);

    // Helper to update styling logic
    const updateLayer = (updates: any) => {
        if (!selectedLayer) return;
        onLayerUpdate(selectedLayer.id, updates);
    }

    // Helper for next styles
    const updateNextStyles = (updates: any) => {
        setNextStyles((prev: any) => ({ ...prev, ...updates }));
    }

    const getLayerName = (layer: any) => {
        const typeName = layer.type === 'text' ? 'TextBox' :
            layer.type === 'image' ? 'Image' :
                layer.type === 'path' ? 'Shape' :
                    layer.type === 'table' ? 'Table' :
                        layer.type === 'placeholder' ? 'Image Slot' : 'Layer';
        return typeName;
    };


    const moveLayer = (dragIndex: number, hoverIndex: number) => {
        const newLayers = [...layers];
        const dragArrayIndex = layers.length - 1 - dragIndex;
        const hoverArrayIndex = layers.length - 1 - hoverIndex;
        const [movedLayer] = newLayers.splice(dragArrayIndex, 1);
        newLayers.splice(hoverArrayIndex, 0, movedLayer);
        if (onReorderLayers) onReorderLayers(newLayers);
    };

    return (
        <div className="w-80 flex flex-col bg-white/90 border-l border-slate-200 backdrop-blur-xl h-full shadow-2xl flex-shrink-0 z-40">
            {/* Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab("text")}
                    className={cn(
                        "flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors relative",
                        activeTab === "text" ? "text-blue-600 bg-blue-50/50" : "text-slate-500 hover:bg-slate-50"
                    )}
                >
                    <Type className="w-4 h-4" />
                    Insert & Style
                    {activeTab === "text" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                </button>
                <button
                    onClick={() => setActiveTab("layers")}
                    className={cn(
                        "flex-1 py-3 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors relative",
                        activeTab === "layers" ? "text-blue-600 bg-blue-50/50" : "text-slate-500 hover:bg-slate-50"
                    )}
                >
                    <Layers className="w-4 h-4" />
                    Layers
                    {activeTab === "layers" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">

                {activeTab === "text" && (
                    <div className="p-4 space-y-8">
                        {/* 1. INSERT MENU (Grid Layout) */}
                        {!textMode ? (
                            <div>
                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Insert</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    <button onClick={() => setTextMode(true)} className="flex flex-col items-center justify-center p-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all shadow-sm group">
                                        <Type className="w-5 h-5 text-slate-700 group-hover:text-blue-600 mb-1" />
                                        <span className="text-[10px] text-slate-600 group-hover:text-blue-600 font-medium">Text</span>
                                    </button>
                                    <button onClick={() => onAddLayer('placeholder')} className="flex flex-col items-center justify-center p-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all shadow-sm group">
                                        <ImageIcon className="w-5 h-5 text-slate-700 group-hover:text-blue-600 mb-1" />
                                        <span className="text-[10px] text-slate-600 group-hover:text-blue-600 font-medium">Image</span>
                                    </button>
                                    <button onClick={() => onAddLayer('table')} className="flex flex-col items-center justify-center p-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all shadow-sm group">
                                        <TableIcon className="w-5 h-5 text-slate-700 group-hover:text-blue-600 mb-1" />
                                        <span className="text-[10px] text-slate-600 group-hover:text-blue-600 font-medium">Table</span>
                                    </button>
                                    {/* Shapes */}
                                    <button onClick={() => onAddLayer('path')} className="flex flex-col items-center justify-center p-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all shadow-sm group">
                                        <Square className="w-5 h-5 text-slate-700 group-hover:text-blue-600 mb-1" />
                                        <span className="text-[10px] text-slate-600 group-hover:text-blue-600 font-medium">Box</span>
                                    </button>
                                    {/* Line */}
                                    <button onClick={() => onAddLayer('line')} className="flex flex-col items-center justify-center p-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-lg transition-all shadow-sm group">
                                        <Minus className="w-5 h-5 text-slate-700 group-hover:text-blue-600 mb-1" />
                                        <span className="text-[10px] text-slate-600 group-hover:text-blue-600 font-medium">Line</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            // TEXT MODE SUBMENU
                            <div className="space-y-4">
                                <button onClick={() => setTextMode(false)} className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-1 mb-2">
                                    ‹ Back to Insert
                                </button>

                                {/* 1. Single Line Textbox */}
                                <DraggableNewText
                                    styles={nextStyles}
                                    isMultiline={false}
                                    onAdd={() => {
                                        onAddLayer('text', {
                                            text: "Your Text Here",
                                            width: 800, // Matches drag default
                                            height: 200,
                                            fontSize: nextStyles.fontSize || 90,
                                            ...nextStyles,
                                            noWrap: true
                                        });
                                    }}
                                />

                                {/* 2. Multi-Line TextArea */}
                                <DraggableNewText
                                    styles={nextStyles}
                                    isMultiline={true}
                                    onAdd={() => {
                                        onAddLayer('text', {
                                            text: "Your Multi-line\nText Here",
                                            width: 800,
                                            height: 400,
                                            fontSize: nextStyles.fontSize || 90,
                                            ...nextStyles,
                                            noWrap: false
                                        });
                                    }}
                                />
                            </div>
                        )}

                        {/* 2. STYLE / TYPOGRAPHY (Contextual OR Pre-config) */}
                        {(selectedLayer || textMode) ? (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div className="h-px bg-slate-200" />

                                {(selectedLayer?.type === 'text' || textMode) && (
                                    <>
                                        {/* Main Font Section */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Typography</h3>
                                            </div>

                                            <FontSelect
                                                value={(selectedLayer ? selectedLayer.fontFamily : nextStyles.fontFamily) || "Arial"}
                                                fonts={FONT_FAMILIES}
                                                onChange={(font) => selectedLayer ? updateLayer({ fontFamily: font }) : updateNextStyles({ fontFamily: font })}
                                            />

                                            <div className="flex gap-2">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Size</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number"
                                                            className="w-16 p-1.5 border rounded-md text-sm text-center"
                                                            value={(selectedLayer ? selectedLayer.fontSize : nextStyles.fontSize) || 16}
                                                            onChange={(e) => selectedLayer ? updateLayer({ fontSize: Number(e.target.value) }) : updateNextStyles({ fontSize: Number(e.target.value) })}
                                                        />
                                                        <input
                                                            type="range"
                                                            min="8" max="120"
                                                            className="flex-1 accent-blue-600 h-1"
                                                            value={(selectedLayer ? selectedLayer.fontSize : nextStyles.fontSize) || 16}
                                                            onChange={(e) => selectedLayer ? updateLayer({ fontSize: Number(e.target.value) }) : updateNextStyles({ fontSize: Number(e.target.value) })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Style Toggles */}
                                            <div className="flex gap-1 bg-slate-100/80 p-1 rounded-lg">
                                                {[
                                                    { key: 'fontWeight', val: 'bold', icon: Bold, default: 'normal' },
                                                    { key: 'fontStyle', val: 'italic', icon: Italic, default: 'normal' },
                                                    { key: 'textDecoration', val: 'underline', icon: Underline, default: 'none' },
                                                    { key: 'textDecoration', val: 'line-through', icon: Strikethrough, default: 'none' }
                                                ].map((style) => {
                                                    const current = selectedLayer ? (selectedLayer as any)[style.key] : (nextStyles as any)[style.key];
                                                    return (
                                                        <button
                                                            key={style.val}
                                                            onClick={() => {
                                                                // Correct toggle logic based on default value
                                                                const defaultValue = (style as any).default;
                                                                const newVal = current === style.val ? defaultValue : style.val;
                                                                selectedLayer ? updateLayer({ [style.key]: newVal }) : updateNextStyles({ [style.key]: newVal });
                                                            }}
                                                            className={cn(
                                                                "flex-1 h-8 rounded-md flex items-center justify-center transition-all",
                                                                (current === style.val)
                                                                    ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                                                                    : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                                                            )}
                                                        >
                                                            <style.icon className="w-4 h-4" />
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Alignment */}
                                            <div className="flex gap-1">
                                                <div className="flex-1 flex gap-1 bg-slate-100/80 p-1 rounded-lg">
                                                    {['left', 'center', 'right', 'justify'].map((align) => {
                                                        const current = selectedLayer ? selectedLayer.align : nextStyles.align;
                                                        return (
                                                            <button
                                                                key={align}
                                                                onClick={() => selectedLayer ? updateLayer({ align }) : updateNextStyles({ align })}
                                                                className={cn(
                                                                    "flex-1 h-8 rounded-md flex items-center justify-center transition-all",
                                                                    (current === align || (!current && align === 'left'))
                                                                        ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                                                                        : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                                                                )}
                                                                title={`Align ${align.charAt(0).toUpperCase() + align.slice(1)}`}
                                                            >
                                                                {align === 'left' && <AlignLeft className="w-4 h-4" />}
                                                                {align === 'center' && <AlignCenter className="w-4 h-4" />}
                                                                {align === 'right' && <AlignRight className="w-4 h-4" />}
                                                                {align === 'justify' && <AlignJustify className="w-4 h-4" />}
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                {/* Super/Sub Script */}
                                                <div className="flex gap-1 bg-slate-100/80 p-1 rounded-lg">
                                                    <button
                                                        onClick={() => {
                                                            const current = selectedLayer ? selectedLayer.verticalAlign : nextStyles.verticalAlign;
                                                            const newVal = current === 'super' ? 'baseline' : 'super';
                                                            selectedLayer ? updateLayer({ verticalAlign: newVal }) : updateNextStyles({ verticalAlign: newVal });
                                                        }}
                                                        className={cn(
                                                            "h-8 w-8 rounded-md flex items-center justify-center transition-all",
                                                            (selectedLayer ? selectedLayer.verticalAlign : nextStyles.verticalAlign) === 'super'
                                                                ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                                                                : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                                                        )}
                                                        title="Superscript"
                                                    >
                                                        <Superscript className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const current = selectedLayer ? selectedLayer.verticalAlign : nextStyles.verticalAlign;
                                                            const newVal = current === 'sub' ? 'baseline' : 'sub';
                                                            selectedLayer ? updateLayer({ verticalAlign: newVal }) : updateNextStyles({ verticalAlign: newVal });
                                                        }}
                                                        className={cn(
                                                            "h-8 w-8 rounded-md flex items-center justify-center transition-all",
                                                            (selectedLayer ? selectedLayer.verticalAlign : nextStyles.verticalAlign) === 'sub'
                                                                ? "bg-white text-blue-600 shadow-sm ring-1 ring-black/5"
                                                                : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                                                        )}
                                                        title="Subscript"
                                                    >
                                                        <Subscript className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-200" />

                                        {/* Color & Background */}
                                        <div className="space-y-4">
                                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Appearance</h3>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Text Color</label>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden relative shadow-sm">
                                                            <input type="color" className="absolute -top-4 -left-4 w-16 h-16 cursor-pointer" value={(selectedLayer ? selectedLayer.color : nextStyles.color) || "#000000"} onChange={(e) => selectedLayer ? updateLayer({ color: e.target.value }) : updateNextStyles({ color: e.target.value })} />
                                                        </div>
                                                        <span className="text-xs text-slate-600 font-mono">{(selectedLayer ? selectedLayer.color : nextStyles.color) || "#000000"}</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Background</label>
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            "w-8 h-8 rounded-full border border-slate-200 overflow-hidden relative shadow-sm hover:ring-2 ring-blue-500/50 transition-all",
                                                            (selectedLayer ? selectedLayer.backgroundColor : nextStyles.backgroundColor) === 'transparent' && "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')] bg-white"
                                                        )}>
                                                            <input
                                                                type="color"
                                                                className="absolute -top-4 -left-4 w-16 h-16 cursor-pointer opacity-0"
                                                                style={{ opacity: (selectedLayer ? selectedLayer.backgroundColor : nextStyles.backgroundColor) === 'transparent' ? 0 : 1 }}
                                                                value={(selectedLayer ? selectedLayer.backgroundColor : nextStyles.backgroundColor) === 'transparent' ? '#ffffff' : ((selectedLayer ? selectedLayer.backgroundColor : nextStyles.backgroundColor) || '#ffffff')}
                                                                onChange={(e) => selectedLayer ? updateLayer({ backgroundColor: e.target.value }) : updateNextStyles({ backgroundColor: e.target.value })}
                                                            />
                                                        </div>
                                                        <button
                                                            className={cn(
                                                                "text-[10px] px-3 py-1.5 rounded-md border transition-all flex items-center gap-1.5",
                                                                (selectedLayer ? selectedLayer.backgroundColor : nextStyles.backgroundColor) === 'transparent'
                                                                    ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                                                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                            )}
                                                            onClick={() => selectedLayer ? updateLayer({ backgroundColor: 'transparent' }) : updateNextStyles({ backgroundColor: 'transparent' })}
                                                        >
                                                            {(selectedLayer ? selectedLayer.backgroundColor : nextStyles.backgroundColor) === 'transparent' && <Check className="w-3 h-3" />}
                                                            Transparent
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Opacity */}
                                                <div>
                                                    <div className="flex justify-between mb-1">
                                                        <label className="text-[10px] font-semibold text-slate-500">Opacity</label>
                                                        <span className="text-[10px] text-slate-400">{Math.round(((selectedLayer ? selectedLayer.opacity : nextStyles.opacity) ?? 1) * 100)}%</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="0" max="1" step="0.1"
                                                        className="w-full accent-blue-600 h-1"
                                                        value={(selectedLayer ? selectedLayer.opacity : nextStyles.opacity) ?? 1}
                                                        onChange={(e) => selectedLayer ? updateLayer({ opacity: parseFloat(e.target.value) }) : updateNextStyles({ opacity: parseFloat(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-200" />

                                        {/* Spacing & Layout */}
                                        <div className="space-y-4">
                                            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Spacing</h3>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Line Height</label>
                                                    <input
                                                        type="number" step="0.1"
                                                        className="w-full p-2 border rounded-md text-sm"
                                                        value={(selectedLayer ? selectedLayer.lineHeight : nextStyles.lineHeight) || 1.2}
                                                        onChange={(e) => selectedLayer ? updateLayer({ lineHeight: Number(e.target.value) }) : updateNextStyles({ lineHeight: Number(e.target.value) })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Letter Spacing</label>
                                                    <input
                                                        type="number"
                                                        className="w-full p-2 border rounded-md text-sm"
                                                        value={parseInt((selectedLayer ? selectedLayer.letterSpacing : nextStyles.letterSpacing) as any || "0")}
                                                        onChange={(e) => selectedLayer ? updateLayer({ letterSpacing: Number(e.target.value) }) : updateNextStyles({ letterSpacing: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </div>

                                            {/* Lists */}
                                            <div>
                                                <label className="text-[10px] font-semibold text-slate-500 mb-1 block">List Style</label>
                                                <div className="flex gap-2">
                                                    <button onClick={() => selectedLayer ? updateLayer({ listStyle: 'none' }) : updateNextStyles({ listStyle: 'none' })} className={cn("flex-1 py-1.5 text-xs border rounded hover:bg-slate-50", (selectedLayer ? selectedLayer.listStyle : nextStyles.listStyle) === 'none' || !(selectedLayer ? selectedLayer.listStyle : nextStyles.listStyle) ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 text-slate-600")}>None</button>
                                                    <button onClick={() => selectedLayer ? updateLayer({ listStyle: 'disc' }) : updateNextStyles({ listStyle: 'disc' })} className={cn("flex-1 py-1.5 text-xs border rounded hover:bg-slate-50", (selectedLayer ? selectedLayer.listStyle : nextStyles.listStyle) === 'disc' ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 text-slate-600")}>• Bullet</button>
                                                    <button onClick={() => selectedLayer ? updateLayer({ listStyle: 'decimal' }) : updateNextStyles({ listStyle: 'decimal' })} className={cn("flex-1 py-1.5 text-xs border rounded hover:bg-slate-50", (selectedLayer ? selectedLayer.listStyle : nextStyles.listStyle) === 'decimal' ? "bg-blue-50 border-blue-200 text-blue-700" : "border-slate-200 text-slate-600")}>1. List</button>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* TABLE SPECIFIC SETTINGS */}
                                {selectedLayer?.type === 'table' && (
                                    <div className="space-y-6">
                                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Table Configuration</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Rows</label>
                                                <input type="number" min="1" className="w-full p-2 border rounded-lg text-sm" value={selectedLayer.rows} onChange={(e) => updateLayer({ rows: Number(e.target.value) })} />
                                            </div>
                                            <div>
                                                <label className="text-xs text-slate-500 block mb-1">Cols</label>
                                                <input type="number" min="1" className="w-full p-2 border rounded-lg text-sm" value={selectedLayer.cols} onChange={(e) => updateLayer({ cols: Number(e.target.value) })} />
                                            </div>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-lg flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-700">Show Borders</span>
                                            <input type="checkbox" checked={selectedLayer.showBorders !== false} onChange={(e) => updateLayer({ showBorders: e.target.checked })} className="w-4 h-4 accent-blue-600" />
                                        </div>
                                    </div>
                                )}

                                {/* LINE SPECIFIC SETTINGS */}
                                {selectedLayer?.type === 'line' && (
                                    <div className="space-y-6">
                                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Line Settings</h3>

                                        {/* Line Color */}
                                        <div>
                                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Line Color</label>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full border border-slate-200 overflow-hidden relative shadow-sm">
                                                    <input
                                                        type="color"
                                                        className="absolute -top-4 -left-4 w-16 h-16 cursor-pointer"
                                                        value={selectedLayer.strokeColor || "#000000"}
                                                        onChange={(e) => updateLayer({ strokeColor: e.target.value })}
                                                    />
                                                </div>
                                                <span className="text-xs text-slate-600 font-mono">{selectedLayer.strokeColor || "#000000"}</span>
                                            </div>
                                        </div>

                                        {/* Line Thickness */}
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-[10px] font-semibold text-slate-500">Thickness</label>
                                                <span className="text-[10px] text-slate-400">{selectedLayer.strokeWidth || 2}px</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="1" max="20" step="1"
                                                className="w-full accent-blue-600 h-1"
                                                value={selectedLayer.strokeWidth || 2}
                                                onChange={(e) => updateLayer({ strokeWidth: Number(e.target.value) })}
                                            />
                                        </div>

                                        {/* Line Orientation */}
                                        <div>
                                            <label className="text-[10px] font-semibold text-slate-500 mb-2 block">Orientation</label>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateLayer({ lineRotation: 0 })}
                                                    className={cn(
                                                        "flex-1 py-2 px-3 text-xs border rounded-lg flex items-center justify-center gap-2 transition-all",
                                                        (selectedLayer.lineRotation === 0 || !selectedLayer.lineRotation)
                                                            ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                                                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <Minus className="w-4 h-4" />
                                                    Horizontal
                                                </button>
                                                <button
                                                    onClick={() => updateLayer({ lineRotation: 90 })}
                                                    className={cn(
                                                        "flex-1 py-2 px-3 text-xs border rounded-lg flex items-center justify-center gap-2 transition-all",
                                                        selectedLayer.lineRotation === 90
                                                            ? "bg-blue-50 border-blue-200 text-blue-700 font-medium"
                                                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <Minus className="w-4 h-4 transform rotate-90" />
                                                    Vertical
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // EMPTY STATE when not in text mode and no selection
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center opacity-60">
                                <MousePointer2 className="w-8 h-8 mb-2" />
                                <p className="text-sm">Select an item to edit styles</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "layers" && (
                    <div className="p-4 space-y-2">
                        {/* Layer Actions Toolbar */}
                        <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 mb-3 space-y-2">
                            {/* Row 1: Group / Ungroup */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (selectedLayerId) {
                                            const layer = layers.find(l => l.id === selectedLayerId);
                                            if (layer) {
                                                const siblings = layers.filter(l => l.parentId === layer.parentId && l.id !== layer.id);
                                                if (siblings.length > 0) {
                                                    onLayerUpdate(siblings[0].id, { parentId: selectedLayerId });
                                                }
                                            }
                                        }
                                    }}
                                    disabled={!selectedLayerId}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                                        selectedLayerId
                                            ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    )}
                                    title="Group (⌘+G)"
                                >
                                    <Group className="w-4 h-4" />
                                    <span>Group</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (selectedLayerId) {
                                            const layer = layers.find(l => l.id === selectedLayerId);
                                            if (layer) {
                                                const children = layers.filter(l => l.parentId === selectedLayerId);
                                                children.forEach(child => {
                                                    onLayerUpdate(child.id, { parentId: layer.parentId || null });
                                                });
                                            }
                                        }
                                    }}
                                    disabled={!selectedLayerId}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                                        selectedLayerId
                                            ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    )}
                                    title="Ungroup (⌘+⇧+G)"
                                >
                                    <Ungroup className="w-4 h-4" />
                                    <span>Ungroup</span>
                                </button>
                            </div>
                            {/* Row 2: Forward / Back */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        if (selectedLayerId) {
                                            const layer = layers.find(l => l.id === selectedLayerId);
                                            if (layer) {
                                                onLayerUpdate(selectedLayerId, { z: (layer.z || 0) + 1 });
                                            }
                                        }
                                    }}
                                    disabled={!selectedLayerId}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                                        selectedLayerId
                                            ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    )}
                                    title="Bring Forward (⌘+])"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                    <span>Forward</span>
                                </button>
                                <button
                                    onClick={() => {
                                        if (selectedLayerId) {
                                            const layer = layers.find(l => l.id === selectedLayerId);
                                            if (layer) {
                                                onLayerUpdate(selectedLayerId, { z: Math.max(0, (layer.z || 0) - 1) });
                                            }
                                        }
                                    }}
                                    disabled={!selectedLayerId}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                                        selectedLayerId
                                            ? "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                                            : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                    )}
                                    title="Send Backward (⌘+[)"
                                >
                                    <ArrowDown className="w-4 h-4" />
                                    <span>Backward</span>
                                </button>
                            </div>
                        </div>

                        {(() => {
                            // Build tree structure from flat layers with parentId
                            const rootLayers = layers.filter(l => !l.parentId);
                            const getChildren = (parentId: string) => layers.filter(l => l.parentId === parentId);

                            // Get all descendant IDs for a layer
                            const getDescendantIds = (layerId: string): string[] => {
                                const children = getChildren(layerId);
                                let ids: string[] = [];
                                for (const child of children) {
                                    ids.push(child.id);
                                    ids = ids.concat(getDescendantIds(child.id));
                                }
                                return ids;
                            };

                            // Type-based colors (light pastel tones)
                            const typeColors: Record<string, { bg: string; border: string; icon: string; text: string }> = {
                                text: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'bg-amber-100 text-amber-600', text: 'text-amber-700' },
                                image: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'bg-purple-100 text-purple-600', text: 'text-purple-700' },
                                placeholder: { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'bg-indigo-100 text-indigo-600', text: 'text-indigo-700' },
                                table: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-700' },
                                path: { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'bg-rose-100 text-rose-600', text: 'text-rose-700' },
                                line: { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'bg-cyan-100 text-cyan-600', text: 'text-cyan-700' },
                            };

                            // Recursive tree item renderer
                            const renderTreeItem = (layer: any, depth: number = 0): React.ReactNode => {
                                const children = getChildren(layer.id);
                                const hasChildren = children.length > 0;
                                const isSelected = layer.id === selectedLayerId;
                                const isCollapsed = layer.collapsed;
                                const colors = typeColors[layer.type] || { bg: 'bg-slate-50', border: 'border-slate-200', icon: 'bg-slate-100 text-slate-600', text: 'text-slate-700' };

                                const Icon = layer.type === 'text' ? Type :
                                    layer.type === 'image' ? ImageIcon :
                                        layer.type === 'table' ? TableIcon :
                                            layer.type === 'placeholder' ? ImageIcon :
                                                layer.type === 'line' ? Minus : Square;

                                return (
                                    <div key={layer.id} className="mb-1.5">
                                        <div
                                            onClick={() => onLayerSelect(layer.id)}
                                            className={cn(
                                                "group flex items-center gap-2 py-2.5 px-3 rounded-lg border transition-all cursor-pointer select-none",
                                                isSelected
                                                    ? "bg-blue-100 border-blue-300 shadow-md ring-2 ring-blue-200"
                                                    : `${colors.bg} ${colors.border} hover:shadow-sm`,
                                                layer.hidden && "opacity-50"
                                            )}
                                            style={{ marginLeft: depth * 20 }}
                                        >
                                            {/* Collapse/Expand button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (hasChildren) {
                                                        onLayerUpdate(layer.id, { collapsed: !isCollapsed });
                                                    }
                                                }}
                                                className={cn(
                                                    "p-1 rounded transition-colors flex-shrink-0",
                                                    hasChildren ? "hover:bg-white/50 text-slate-500" : "invisible"
                                                )}
                                            >
                                                {hasChildren && (isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                                            </button>

                                            {/* Layer icon with type color */}
                                            <div className={cn(
                                                "p-1.5 rounded-md flex-shrink-0",
                                                isSelected ? "bg-white text-blue-600 shadow-sm" : colors.icon
                                            )}>
                                                <Icon className="w-3.5 h-3.5" />
                                            </div>

                                            {/* Layer name */}
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    "text-sm font-medium truncate",
                                                    isSelected ? "text-blue-800" : colors.text
                                                )}>
                                                    {layer.name || getLayerName(layer)}
                                                </p>
                                                {hasChildren && (
                                                    <p className="text-[9px] text-slate-400 mt-0.5">
                                                        {children.length} nested layer{children.length > 1 ? 's' : ''}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions - always visible for clarity */}
                                            <div className="flex gap-1 flex-shrink-0">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Toggle hidden for layer and all descendants
                                                        const newHidden = !layer.hidden;
                                                        onLayerUpdate(layer.id, { hidden: newHidden });
                                                        getDescendantIds(layer.id).forEach(id => {
                                                            onLayerUpdate(id, { hidden: newHidden });
                                                        });
                                                    }}
                                                    className={cn(
                                                        "p-1.5 rounded-md transition-colors",
                                                        layer.hidden
                                                            ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                                                            : "hover:bg-white/80 text-slate-400 hover:text-slate-600"
                                                    )}
                                                    title={layer.hidden ? "Show layer" : "Hide layer"}
                                                >
                                                    {layer.hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // Delete layer and all descendants
                                                        getDescendantIds(layer.id).reverse().forEach(id => {
                                                            onLayerDelete(id);
                                                        });
                                                        onLayerDelete(layer.id);
                                                    }}
                                                    className="p-1.5 hover:bg-red-100 rounded-md text-slate-400 hover:text-red-500 transition-colors"
                                                    title="Delete layer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Render children if not collapsed */}
                                        {hasChildren && !isCollapsed && (
                                            <div className="ml-4 pl-3 border-l-2 border-slate-200 mt-1">
                                                {children.map(child => renderTreeItem(child, depth + 1))}
                                            </div>
                                        )}
                                    </div>
                                );
                            };

                            // Handler to reparent a layer (make it child of another or root)
                            const handleReparent = (draggedId: string, newParentId: string | null) => {
                                onLayerUpdate(draggedId, { parentId: newParentId });
                            };

                            return rootLayers.length > 0 ? (
                                <>
                                    <DropZoneForRoot onDrop={(id: string) => handleReparent(id, null)} />
                                    {rootLayers.map(layer => (
                                        <DraggableTreeItem
                                            key={layer.id}
                                            layer={layer}
                                            depth={0}
                                            isSelected={selectedLayerId}
                                            onSelect={onLayerSelect}
                                            onUpdate={onLayerUpdate}
                                            onDelete={onLayerDelete}
                                            getLayerName={getLayerName}
                                            getChildren={getChildren}
                                            getDescendantIds={getDescendantIds}
                                            typeColors={typeColors}
                                            onReparent={handleReparent}
                                        />
                                    ))}
                                </>
                            ) : (
                                <div className="text-center text-slate-400 py-8 text-sm">
                                    No layers yet
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
}
