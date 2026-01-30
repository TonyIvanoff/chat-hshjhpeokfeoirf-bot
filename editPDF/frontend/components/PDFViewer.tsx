"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";

// Configure worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
    url: string;
    initialPage?: number;
    scale?: number;
    rotate?: number;
    hideToolbar?: boolean;
    onPageLoadSuccess?: (page: { width: number; height: number; originalWidth: number; originalHeight: number }) => void;
    onDocumentLoadSuccess?: (numPages: number) => void;
}

export function PDFViewer({ url, initialPage = 1, scale: externalScale, rotate = 0, hideToolbar = false, onPageLoadSuccess, onDocumentLoadSuccess: onDocumentLoadSuccessProp }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [pageNumber, setPageNumber] = useState<number>(initialPage);
    const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null);

    // Measure container
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(0);
    const [containerHeight, setContainerHeight] = useState<number>(0);

    // Simple ResizeObserver for container
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
                setContainerHeight(entry.contentRect.height);
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // Calculate Scale
    // If externalScale provided, use it.
    // Else, Auto-Fit: min(1, container / page) - "Shrink to Fit"
    const calculatedScale = useMemo(() => {
        if (externalScale) return externalScale;
        if (!pageDimensions || containerWidth === 0) return 1.0;

        const widthScale = (containerWidth - 40) / pageDimensions.width; // 40px padding safety
        const heightScale = (containerHeight - 40) / pageDimensions.height;

        // Fit Whole Page
        const fitScale = Math.min(widthScale, heightScale);

        // Don't upscale blurrily, but do shrink. 
        // Actually user said "adjust zoom ... if pdf page does not fit". 
        // Meaning if it fits (scale > 1), keep 1? Or maximize? 
        // usually "Fit to Page" implies filling the view.
        // Let's safe limit to 1.5x to avoid pixelation, or just use fitScale.
        return fitScale;
    }, [externalScale, pageDimensions, containerWidth, containerHeight]);

    // Update page if prop changes
    useEffect(() => {
        setPageNumber(initialPage);
    }, [initialPage]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages);
        onDocumentLoadSuccessProp?.(numPages);
    }

    function onPageLoad(page: any) {
        // react-pdf page object keys vary in versions, but usually has originalWidth/Height
        const { originalWidth, originalHeight } = page;
        setPageDimensions({ width: originalWidth, height: originalHeight });
        if (onPageLoadSuccess) {
            onPageLoadSuccess({ width: originalWidth * calculatedScale, height: originalHeight * calculatedScale, originalWidth, originalHeight });
        }
    }

    return (
        <div className="flex flex-col h-full w-full" ref={containerRef}>
            {/* Toolbar - Only show if NO external scale (interactive mode) */}
            {!hideToolbar && !externalScale && (
                <div className="flex items-center justify-between p-2 glass-panel mb-2 bg-white/40 rounded-lg">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                            disabled={pageNumber <= 1}
                            className="p-1 hover:bg-white/50 rounded disabled:opacity-30"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm font-medium text-slate-700">
                            Page {pageNumber} of {numPages || "--"}
                        </span>
                        <button
                            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                            disabled={pageNumber >= numPages}
                            className="p-1 hover:bg-white/50 rounded disabled:opacity-30"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Auto-Zoom indicator */}
                    <span className="text-xs font-medium text-slate-600 w-12 text-center">
                        {Math.round(calculatedScale * 100)}%
                    </span>
                </div>
            )}

            {/* Document Canvas */}
            <div className="flex-1 overflow-auto flex justify-center bg-slate-50/50 rounded-xl border border-slate-200/50 p-4">
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="flex justify-center"
                    loading={<div className="animate-pulse w-full h-96 bg-slate-200 rounded-lg" />}
                    error={
                        <div className="flex items-center justify-center p-10 text-red-400">
                            Failed to load PDF.
                        </div>
                    }
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={calculatedScale}
                        rotate={rotate}
                        onLoadSuccess={onPageLoad}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="rounded-lg overflow-hidden glass-panel border-0"
                    />
                </Document>
            </div>
        </div>
    );
}
