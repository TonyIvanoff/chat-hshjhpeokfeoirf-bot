"use client";

import { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { X, Save } from "lucide-react";
import { cn } from "@/lib/utils";

// Configure worker (redundant if already in PDFViewer, but safe to set again)
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
}

interface PageReorderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (pageOrder: number[]) => void;
    pdfUrl: string;
    numPages: number;
}

interface DraggablePageProps {
    pageNumber: number;
    index: number;
    movePage: (dragIndex: number, hoverIndex: number) => void;
    pdfUrl: string;
}

const DraggablePage = ({ pageNumber, index, movePage, pdfUrl }: DraggablePageProps) => {
    const ref = (node: HTMLDivElement | null) => {
        drag(drop(node));
    };

    const [, drop] = useDrop({
        accept: "PAGE_THUMB",
        hover(item: { index: number }) {
            if (!item) return;
            const dragIndex = item.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) return;

            movePage(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag] = useDrag({
        type: "PAGE_THUMB",
        item: { index },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    return (
        <div
            ref={ref}
            className={cn(
                "relative bg-white border rounded shadow hover:shadow-lg transition-all cursor-grab active:cursor-grabbing",
                isDragging ? "opacity-50 scale-95" : "opacity-100"
            )}
        >
            <div className="aspect-[1/1.4] overflow-hidden pointer-events-none rounded-t bg-slate-100 flex items-center justify-center">
                {/* Thumbnail */}
                <Document file={pdfUrl} loading={<div className="w-full h-full bg-slate-200 animate-pulse" />}>
                    <Page
                        pageNumber={pageNumber}
                        width={150}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="shadow-sm"
                    />
                </Document>
            </div>
            <div className="p-2 text-center text-xs font-medium text-slate-600 border-t bg-slate-50 rounded-b flex justify-between items-center">
                <span>Pg {index + 1}</span>
                <span className="text-slate-400 text-[10px]">(Orig {pageNumber})</span>
            </div>
        </div>
    );
};

export function PageReorderModal({ isOpen, onClose, onExport, pdfUrl, numPages }: PageReorderModalProps) {
    // pageOrder stores the *original* 1-based page numbers in their new order
    // e.g. [1, 2, 3] -> [3, 1, 2]
    const [pageOrder, setPageOrder] = useState<number[]>([]);

    useEffect(() => {
        if (isOpen && numPages > 0) {
            // Initialize 1..N
            setPageOrder(Array.from({ length: numPages }, (_, i) => i + 1));
        }
    }, [isOpen, numPages]);

    const movePage = (dragIndex: number, hoverIndex: number) => {
        const newOrder = [...pageOrder];
        const [draggedItem] = newOrder.splice(dragIndex, 1);
        newOrder.splice(hoverIndex, 0, draggedItem);
        setPageOrder(newOrder);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-8">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between bg-slate-50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Reorder Pages</h2>
                        <p className="text-sm text-slate-500">Drag and drop to rearrange pages before export.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-600" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-slate-100/50">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {pageOrder.map((originalPageNum, index) => (
                            <DraggablePage
                                key={`page-${originalPageNum}-pos-${index}`} // Key usually should be stable ID, but here index changes. Using originalPage as ID is better IF unique. Keys must be unique. pageOrder contains unique pages.
                                // Actually, use originalPageNum as key is safe if no duplicates.
                                // But if we duplicate pages later, we need unique IDs. For now, unique.
                                pageNumber={originalPageNum}
                                index={index}
                                movePage={movePage}
                                pdfUrl={pdfUrl}
                            />
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            // Returns 0-based indices for backend
                            onExport(pageOrder.map(p => p - 1));
                        }}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-500/25 flex items-center gap-2 transition-all"
                    >
                        <Save className="w-4 h-4" />
                        Export PDF
                    </button>
                </div>
            </div>
        </div>
    );
}
