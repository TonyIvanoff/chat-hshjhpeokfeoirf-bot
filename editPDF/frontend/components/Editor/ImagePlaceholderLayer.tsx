import { useDrag } from "react-dnd";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Upload } from "lucide-react";
import { ImagePlaceholderLayerData } from "@/types/editor";

interface ImagePlaceholderLayerProps extends ImagePlaceholderLayerData {
    scale?: number;
    isSelected?: boolean;
    onSelect?: (id: string | null) => void;
    onUpload?: (id: string, file: File) => void; // Callback to parent to transform this layer
}

export function ImagePlaceholderLayer({
    id, x, y, width, height, rotation, z, label,
    isSelected, onSelect, onUpload
}: ImagePlaceholderLayerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const [{ isDragging }, drag] = useDrag({
        type: "PLACEHOLDER_LAYER",
        item: { id, type: 'placeholder' },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    drag(ref);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                if (onUpload) onUpload(id, file); // Parent needs to handle this
            }
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            if (onUpload) onUpload(id, e.target.files[0]);
        }
    }

    return (
        <div
            ref={ref}
            onClick={(e) => {
                e.stopPropagation();
                onSelect?.(id);
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
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
                "group border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-move transition-all overflow-hidden bg-slate-50/50 backdrop-blur-sm",
                isSelected ? "border-blue-500 ring-2 ring-blue-500/20" : "border-slate-300 hover:border-blue-400",
                isDragOver ? "border-blue-500 bg-blue-50" : ""
            )}
        >
            <div className="flex flex-col items-center gap-2 text-slate-400 p-4 text-center pointer-events-none">
                <div className="p-3 bg-white rounded-full shadow-sm">
                    {isDragOver ? <Upload className="w-6 h-6 text-blue-500 animate-bounce" /> : <ImageIcon className="w-6 h-6" />}
                </div>
                <p className="text-xs font-medium max-w-[80%]">
                    {label || "Drop image here"}
                </p>
                <p className="text-[10px] opacity-70">or click to upload</p>
            </div>

            {/* Hidden click-to-upload trigger if needed, or just double click? 
                Let's make a button or area clickable for upload if selected */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
            />
            {isSelected && (
                <button
                    className="absolute inset-0 z-10"
                    onDoubleClick={() => fileInputRef.current?.click()}
                    title="Double click to upload"
                />
            )}

            {/* Resize Handles (reuse generic later, for now illustrative) */}
            {isSelected && (
                <>
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-500 rounded-full border border-white" />
                </>
            )}
        </div>
    );
}
