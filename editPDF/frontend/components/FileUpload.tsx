"use client";

import { useState, useCallback } from "react";
import { UploadCloud, Loader2 } from "lucide-react";

// Actually, I'll use simple HTML drag and drop API to avoid extra dependency for now, or just install it. 
// Let's implement a simple custom drag drop to keep it lightweight or check if I installed it.
// I did NOT install react-dropzone. I will use a simple file input styled as a dropzone.

export function FileUpload({ onUpload }: { onUpload: (url: string, text?: string) => void }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleFile = async (file: File) => {
        if (file.type !== "application/pdf") return alert("Only PDF files are allowed");

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("http://localhost:8000/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.url) {
                onUpload(data.url, data.text);
            }
        } catch (e) {
            console.error(e);
            alert("Upload failed");
        } finally {
            setIsUploading(false);
        }
    };

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => setIsDragging(false);

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    return (
        <div
            className={`glass-panel rounded-2xl p-10 flex flex-col items-center justify-center border-2 border-dashed transition-all cursor-pointer
        ${isDragging ? "border-blue-500 bg-blue-50/50" : "border-slate-300 hover:border-blue-400"}
      `}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => document.getElementById("file-upload")?.click()}
        >
            <input
                type="file"
                id="file-upload"
                className="hidden"
                accept="application/pdf"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />

            {isUploading ? (
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            ) : (
                <UploadCloud className={`w-12 h-12 mb-4 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
            )}

            <h3 className="text-lg font-semibold text-slate-700">
                {isUploading ? "Uploading..." : "Upload PDF Document"}
            </h3>
            <p className="text-slate-500 mt-2 text-sm text-center max-w-xs">
                Drag & drop your PDF here, or click to browse files
            </p>
        </div>
    );
}
