export type LayerType = 'text' | 'image' | 'path' | 'table' | 'placeholder' | 'line';

export interface BaseLayer {
    id: string;
    type: LayerType;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    z?: number;
    hidden?: boolean;
    // Hierarchy support
    parentId?: string | null;  // ID of parent layer (null = top-level)
    collapsed?: boolean;       // UI: collapse children in tree view
    locked?: boolean;          // Prevent editing
    name?: string;             // Custom layer name
}

export interface TextLayerData extends BaseLayer {
    type: 'text';
    text: string;
    fontSize: number;
    fontFamily: string;
    color: string;
    fontWeight?: string;
    fontStyle?: string;
    textDecoration?: 'none' | 'underline' | 'line-through';
    align?: 'left' | 'center' | 'right' | 'justify';
    backgroundColor?: string;
    lineHeight?: number;
    letterSpacing?: number;
    opacity?: number;
    listStyle?: 'none' | 'disc' | 'decimal';
    boxShadow?: string; // For "shadow" effect on the box
    borderRadius?: number; // For rounded corners
    noWrap?: boolean;
    verticalAlign?: 'baseline' | 'sub' | 'super';
}

export interface ImageLayerData extends BaseLayer {
    type: 'image';
    src: string; // Data URL
    opacity?: number;
}

export interface ImagePlaceholderLayerData extends BaseLayer {
    type: 'placeholder';
    label?: string;
}

export interface PathLayerData extends BaseLayer {
    type: 'path';
    d: string; // SVG Path Data
    fill: string;
    stroke: string;
    strokeWidth: number;
}

export interface LineLayerData extends BaseLayer {
    type: 'line';
    strokeColor: string;
    strokeWidth: number;
    lineRotation: 0 | 90;  // 0 = horizontal, 90 = vertical
}

export interface TableLayerData extends BaseLayer {
    type: 'table';
    rows: number;
    cols: number;
    data: string[][]; // Cell content
    borderColor?: string;
    borderWidth?: number;
    showBorders?: boolean; // simplified for now
}

export type Layer = TextLayerData | ImageLayerData | PathLayerData | TableLayerData | ImagePlaceholderLayerData | LineLayerData;
