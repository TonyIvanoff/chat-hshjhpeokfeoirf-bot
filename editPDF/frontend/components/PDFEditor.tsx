"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { EditorSidebar } from "./Editor/EditorSidebar";
import { FileUpload } from "./FileUpload";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("./PDFViewer").then(mod => mod.PDFViewer), {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-full text-slate-400">Loading Viewer...</div>
});


import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { LayerCanvas } from "./Editor/LayerCanvas";
import { Loader2, Wand2, ChevronLeft, ChevronRight, Save, ZoomIn, ZoomOut, RotateCw, Undo2, Redo2 } from "lucide-react";

const PageReorderModal = dynamic(() => import("./PageReorderModal").then(mod => mod.PageReorderModal), {
    ssr: false
});

export function PDFEditor() {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
    const [numPages, setNumPages] = useState(0); // Add numPages tracking

    // Editor Panel State
    const [editPage, setEditPage] = useState<number>(1);
    const [analyzedPages, setAnalyzedPages] = useState<Record<number, any>>({});
    const [isProcessing, setIsProcessing] = useState(false);
    const [filename, setFilename] = useState<string | null>(null);
    const [rightZoom, setRightZoom] = useState<number>(1.0); // Default 100%
    const [rotation, setRotation] = useState<number>(0);
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
    const rightPanelRef = useRef<HTMLDivElement>(null);

    // Per-page undo/redo history (max 50 states per page)
    const MAX_HISTORY = 50;
    const [pageHistories, setPageHistories] = useState<Record<number, { past: any[][]; future: any[][] }>>({});

    const handleUpload = (url: string, name?: string) => {
        setPdfUrl(url);
        setFilename(name || null);
        // Reset state on new upload
        setEditPage(1);
        setAnalyzedPages({});
        setPageHistories({});
        setRightZoom(1.0);
        setRotation(0);
        setSelectedLayerId(null);
    };

    // Layer update with history tracking
    const handleLayersUpdate = useCallback((updatedLayers: any[]) => {
        setAnalyzedPages((prev: Record<number, any>) => {
            const currentLayers = prev[editPage]?.layers || [];

            // Only track if layers actually changed
            if (JSON.stringify(currentLayers) !== JSON.stringify(updatedLayers)) {
                setPageHistories(ph => {
                    const pageHistory = ph[editPage] || { past: [], future: [] };
                    return {
                        ...ph,
                        [editPage]: {
                            past: [...pageHistory.past, currentLayers].slice(-MAX_HISTORY),
                            future: [] // Clear future on new action
                        }
                    };
                });
            }

            return {
                ...prev,
                [editPage]: {
                    ...prev[editPage],
                    layers: updatedLayers
                }
            };
        });
    }, [editPage]);

    // Undo action
    const handleUndo = useCallback(() => {
        const pageHistory = pageHistories[editPage];
        if (!pageHistory || pageHistory.past.length === 0) return;

        const newPast = [...pageHistory.past];
        const previousLayers = newPast.pop()!;
        const currentLayers = analyzedPages[editPage]?.layers || [];

        setPageHistories(ph => ({
            ...ph,
            [editPage]: {
                past: newPast,
                future: [currentLayers, ...(ph[editPage]?.future || [])].slice(0, MAX_HISTORY)
            }
        }));

        setAnalyzedPages(prev => ({
            ...prev,
            [editPage]: {
                ...prev[editPage],
                layers: previousLayers
            }
        }));
    }, [editPage, pageHistories, analyzedPages]);

    // Redo action
    const handleRedo = useCallback(() => {
        const pageHistory = pageHistories[editPage];
        if (!pageHistory || pageHistory.future.length === 0) return;

        const newFuture = [...pageHistory.future];
        const nextLayers = newFuture.shift()!;
        const currentLayers = analyzedPages[editPage]?.layers || [];

        setPageHistories(ph => ({
            ...ph,
            [editPage]: {
                past: [...(ph[editPage]?.past || []), currentLayers].slice(-MAX_HISTORY),
                future: newFuture
            }
        }));

        setAnalyzedPages(prev => ({
            ...prev,
            [editPage]: {
                ...prev[editPage],
                layers: nextLayers
            }
        }));
    }, [editPage, pageHistories, analyzedPages]);

    // Check if undo/redo is available for current page
    const canUndo = (pageHistories[editPage]?.past?.length || 0) > 0;
    const canRedo = (pageHistories[editPage]?.future?.length || 0) > 0;

    // Keyboard shortcuts for Undo/Redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if we're in an editable context (input, textarea, contenteditable)
            const target = e.target as HTMLElement;
            const isEditable = target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable;

            // Only handle if not in an editable element and page is analyzed
            if (!isEditable && analyzedPages[editPage]) {
                // Ctrl/Cmd + Shift + Z = Redo
                if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    handleRedo();
                }
                // Ctrl/Cmd + Z = Undo
                else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    handleUndo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editPage, analyzedPages, handleUndo, handleRedo]);

    const selectedLayer = analyzedPages[editPage]?.layers?.find((l: any) => l.id === selectedLayerId) || null;

    // Auto-Fit Right Panel when Analysis completes
    useEffect(() => {
        const pageData = analyzedPages[editPage];
        if (pageData && rightPanelRef.current) {
            const { width: pageW, height: pageH } = pageData;
            const { clientWidth: containerW, clientHeight: containerH } = rightPanelRef.current;

            // "Shrink to Fit" meaning: if page is larger than container, shrink it.
            // But if it fits, stick to 1.0 (unless it's tiny?)
            // Propmt says: "if pdf page does not fit, reduce zoom".

            // Fit Width Logic
            // Sidebar width is w-80 (320px) + padding (48px)
            const sidebarWidth = 320;
            const availableWidth = containerW - sidebarWidth - 48;

            // Calculate scale to fit width
            const wScale = availableWidth / pageW;

            // Default to Fit Width
            // But cap at 1.5x to avoid overwhelming zoom on large monitors/portrait pages
            setRightZoom(Math.min(wScale, 1.5));
        }
    }, [analyzedPages, editPage]);

    // Keep Page Centered when Zooming
    useEffect(() => {
        // Small timeout to allow DOM layout update
        const timer = setTimeout(() => {
            if (rightPanelRef.current) {
                const scrollContainer = rightPanelRef.current.querySelector('.overflow-auto');
                if (scrollContainer) {
                    const scrollX = (scrollContainer.scrollWidth - scrollContainer.clientWidth) / 2;
                    const scrollY = (scrollContainer.scrollHeight - scrollContainer.clientHeight) / 2;

                    // Only adjust if we actually have scrollable overflow
                    if (scrollX > 0) scrollContainer.scrollLeft = scrollX;
                    if (scrollY > 0) scrollContainer.scrollTop = scrollY;
                }
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [rightZoom, editPage, analyzedPages]); // Re-center on zoom, page change, or load

    // Auto-Fit for PDF Preview (before analysis)
    const handlePreviewLoad = (page: { originalWidth: number; originalHeight: number }) => {
        if (rightPanelRef.current) {
            const { originalWidth: pageW, originalHeight: pageH } = page;
            const { clientWidth: containerW, clientHeight: containerH } = rightPanelRef.current;

            const wScale = (containerW - 48) / pageW;
            const hScale = (containerH - 80) / pageH;
            const fitScale = Math.min(wScale, hScale);

            if (fitScale < 1.0) {
                setRightZoom(fitScale);
            } else {
                setRightZoom(1.0);
            }
        }
    }

    // We need to know numPages for the modal. 
    // PDFViewer doesn't currently expose it up, it keeps it local.
    // Let's assume we can get it from the viewer via onDocumentLoadSuccess callback if we add one.
    // OR we can just add a prop to PDFViewer to report it.
    // For now, let's update handlePreviewLoad or add a new callback.
    const onDocumentLoadSuccess = (docNumPages: number) => {
        setNumPages(docNumPages);
    };

    const analyzeCurrentPage = async () => {
        if (!filename) return;

        setIsProcessing(true);
        try {
            // Page is 0-indexed for backend usually, but UI is 1-indexed. Let's assume backend expects 0-indexed.
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/process-page`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename, page: editPage - 1 })
            });
            const data = await res.json();
            if (data.error) {
                console.error("Analysis Error:", data.error);
                alert(`Error analyzing page: ${data.error}`);
                return;
            }
            setAnalyzedPages((prev: Record<number, any>) => ({ ...prev, [editPage]: data }));
        } catch (e) {
            console.error("Processing failed", e);
            alert("Failed to analyze page");
        } finally {
            setIsProcessing(false);
        }
    };

    const onFileUpload = (url: string) => {
        const fname = url.split('/').pop();
        handleUpload(url, fname);
    };

    const handleSave = () => {
        // Since state is already updated via onLayersChange, this is just a confirmation
        alert("Changes saved to current session.");
    };

    const handleExport = async (pageOrder?: number[]) => {
        if (!filename) return;
        setIsProcessing(true);
        // If coming from modal, close it
        setIsReorderModalOpen(false);

        try {
            // Prepare modifications map (convert 1-based UI pages to 0-based backend)
            const modifications: Record<string, any> = {};
            Object.entries(analyzedPages).forEach(([pageNum, data]) => {
                const backendIndex = parseInt(pageNum) - 1;
                modifications[backendIndex.toString()] = data;
            });

            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/export-all`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename,
                    modifications,
                    pageOrder // Pass reordered indices (0-based)
                })
            });

            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `exported_full_${filename}`;
                a.click();
            } else {
                const err = await res.json();
                alert("Export failed: " + (err.error || "Unknown error"));
            }
        } catch (e) {
            console.error("Export error", e);
            alert("Export error");
        } finally {
            setIsProcessing(false);
        }
    };

    if (!pdfUrl) {
        return (
            <div className="flex items-center justify-center min-h-[calc(100vh-5rem)]">
                <FileUpload onUpload={onFileUpload} />
            </div>
        );
    }

    return (
        <DndProvider backend={HTML5Backend}>
            <div className="flex flex-col h-[calc(100vh-5rem)] p-4">
                {/* Reorder Modal */}
                <PageReorderModal
                    isOpen={isReorderModalOpen}
                    onClose={() => setIsReorderModalOpen(false)}
                    onExport={handleExport}
                    pdfUrl={pdfUrl || ""}
                    numPages={numPages}
                />

                {/* Main Editor Panel */}
                <div
                    ref={rightPanelRef}
                    className="glass-panel rounded-2xl flex-1 relative overflow-hidden flex flex-col bg-slate-200/50 shadow-xl border border-white/40"
                >
                    {/* Scrollable Content Area */}
                    <div className="flex-1 relative overflow-hidden flex flex-col">
                        {analyzedPages[editPage] ? (
                            <div className="flex flex-1 h-full overflow-hidden">
                                <div className="flex-1 h-full overflow-auto bg-slate-200/50 relative">
                                    <LayerCanvas
                                        initialLayers={analyzedPages[editPage].layers}
                                        width={analyzedPages[editPage].width}
                                        height={analyzedPages[editPage].height}
                                        scale={rightZoom}
                                        rotate={rotation}
                                        selectedLayerId={selectedLayerId}
                                        onLayerSelect={setSelectedLayerId}
                                        onLayersChange={handleLayersUpdate}
                                        // Pass onAddLayer to Canvas for Drag & Drop
                                        onAddLayer={(type, payload) => {
                                            const newId = crypto.randomUUID();
                                            const layerDefaults: any = {
                                                id: newId,
                                                type,
                                                width: 100, height: 50, rotation: 0,
                                                ...payload
                                            };
                                            const currentLayers = analyzedPages[editPage].layers || [];
                                            handleLayersUpdate([...currentLayers, layerDefaults]);
                                            setSelectedLayerId(newId);
                                        }}
                                    />
                                </div>
                                <EditorSidebar
                                    layers={analyzedPages[editPage].layers}
                                    selectedLayerId={selectedLayerId}
                                    onLayerSelect={setSelectedLayerId}
                                    onLayerUpdate={(id, updates) => {
                                        // Update styling or attributes (like hidden)
                                        const currentLayers = analyzedPages[editPage].layers;
                                        const updatedLayers = currentLayers.map((l: any) =>
                                            l.id === id ? { ...l, ...updates } : l
                                        );
                                        handleLayersUpdate(updatedLayers);
                                    }}
                                    onLayerDelete={(id: string) => {
                                        const currentLayers = analyzedPages[editPage].layers;
                                        const updatedLayers = currentLayers.filter((l: any) => l.id !== id);
                                        handleLayersUpdate(updatedLayers);
                                        if (selectedLayerId === id) setSelectedLayerId(null);
                                    }}
                                    onAddLayer={(type: string, payload?: any) => {
                                        const newId = crypto.randomUUID();
                                        const pageCenter = { x: 50, y: 50 };
                                        let newLayer: any = {
                                            id: newId,
                                            type,
                                            x: pageCenter.x,
                                            y: pageCenter.y,
                                            width: 100,
                                            height: 50,
                                            rotation: 0,
                                            ...payload // MERGE PAYLOAD (overrides defaults)
                                        };

                                        if (type === 'text' && !payload) { // Only set defaults if no payload
                                            newLayer = {
                                                ...newLayer,
                                                text: "New Text",
                                                fontSize: 16,
                                                fontFamily: "Arial",
                                                color: "#000000"
                                            };
                                        } else if (type === 'placeholder') {
                                            newLayer = { ...newLayer, width: 200, height: 200, label: "Drop Image Here" };
                                        } else if (type === 'path') {
                                            newLayer = { ...newLayer, width: 100, height: 100, d: "M 0 0 L 100 0 L 100 100 L 0 100 Z", stroke: "#000000", strokeWidth: 2, fill: "transparent" };
                                        } else if (type === 'table') {
                                            newLayer = { ...newLayer, width: 300, height: 150, rows: 3, cols: 3, data: [['', '', ''], ['', '', ''], ['', '', '']], showBorders: true, borderColor: "#000000" };
                                        } else if (type === 'line') {
                                            newLayer = { ...newLayer, width: 150, height: 3, strokeColor: "#000000", strokeWidth: 3, lineRotation: 0 };
                                        }

                                        const currentLayers = analyzedPages[editPage].layers || [];
                                        handleLayersUpdate([...currentLayers, newLayer]);
                                        setSelectedLayerId(newId);
                                    }}
                                />
                            </div>
                        ) : (
                            // Show standard PDF Preview for this page if not analyzed
                            <div className="w-full h-full flex flex-col items-center opacity-100 bg-slate-500/10">
                                <div className="relative w-full h-full overflow-auto flex items-center justify-center p-8">
                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur text-white px-4 py-1.5 rounded-full text-sm z-20 pointer-events-none shadow-lg">
                                        Preview Mode (Page {editPage})
                                    </div>
                                    {/* Use PDFViewer but ensure it fits nicely */}
                                    <div className="shadow-2xl">
                                        <PDFViewer
                                            url={pdfUrl}
                                            initialPage={editPage}
                                            scale={rightZoom}
                                            hideToolbar={true}
                                            onPageLoadSuccess={handlePreviewLoad}
                                            onDocumentLoadSuccess={onDocumentLoadSuccess} // New prop
                                            rotate={rotation}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Floating Toolbar (Bottom Center or Top?) - Keeping existing Top Toolbar inside panel for now */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-4 p-2 pl-4 pr-2 bg-black/80 backdrop-blur-md rounded-full shadow-2xl z-30 border border-white/10 text-white">
                        {/* Page Navigation */}
                        <div className="flex items-center gap-2 border-r border-white/20 pr-4">
                            <button
                                onClick={() => setEditPage(p => Math.max(1, p - 1))}
                                className="p-1.5 hover:bg-white/20 rounded-full disabled:opacity-30 transition-colors"
                                disabled={editPage <= 1 || isProcessing}
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                            <span className="text-sm font-medium w-16 text-center tabular-nums">Page {editPage}</span>
                            <button
                                onClick={() => setEditPage(p => p + 1)}
                                className="p-1.5 hover:bg-white/20 rounded-full disabled:opacity-30 transition-colors"
                                disabled={isProcessing}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Zoom & Rotation */}
                        <div className="flex items-center gap-2 border-r border-white/20 pr-4">
                            <button onClick={() => setRightZoom(s => Math.max(0.1, s - 0.1))} className="p-1.5 hover:bg-white/20 rounded-full transition-colors"><ZoomOut className="w-4 h-4" /></button>
                            <span className="text-xs font-medium w-10 text-center tabular-nums">{Math.round(rightZoom * 100)}%</span>
                            <button onClick={() => setRightZoom(s => Math.min(4.0, s + 0.1))} className="p-1.5 hover:bg-white/20 rounded-full transition-colors"><ZoomIn className="w-4 h-4" /></button>

                            {/* Fit Page Button (Maximize) */}
                            <button
                                onClick={() => {
                                    if (rightPanelRef.current && analyzedPages[editPage]) {
                                        const pW = analyzedPages[editPage].width;
                                        const pH = analyzedPages[editPage].height;
                                        const cW = rightPanelRef.current.clientWidth - 380; // Sidebar
                                        const cH = rightPanelRef.current.clientHeight - 80; // Vertical Padding

                                        const wScale = cW / pW;
                                        const hScale = cH / pH;

                                        // Fit Page (Best Fit)
                                        setRightZoom(Math.min(wScale, hScale));
                                    } else {
                                        setRightZoom(1);
                                    }
                                }}
                                className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                                title="Fit Page"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>
                            </button>

                            <button onClick={() => setRotation(r => (r + 90) % 360)} className="p-1.5 hover:bg-white/20 rounded-full ml-1 transition-colors" title="Rotate"><RotateCw className="w-4 h-4" /></button>
                        </div>

                        {/* Undo/Redo */}
                        {analyzedPages[editPage] && (
                            <div className="flex items-center gap-1 border-r border-white/20 pr-4">
                                <button
                                    onClick={handleUndo}
                                    disabled={!canUndo}
                                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={`Undo (${pageHistories[editPage]?.past?.length || 0} steps)`}
                                >
                                    <Undo2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleRedo}
                                    disabled={!canRedo}
                                    className="p-1.5 hover:bg-white/20 rounded-full transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title={`Redo (${pageHistories[editPage]?.future?.length || 0} steps)`}
                                >
                                    <Redo2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {!analyzedPages[editPage] ? (
                                <button
                                    onClick={analyzeCurrentPage}
                                    disabled={isProcessing}
                                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-full flex items-center gap-2 transition-all shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                    <span>Edit Page</span>
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={handleSave}
                                        className="px-3 py-1.5 hover:bg-white/20 text-white text-sm font-medium rounded-full flex items-center gap-2 transition-all"
                                        title="Save current changes (Ctrl+S)"
                                    >
                                        <Save className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setIsReorderModalOpen(true)}
                                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-full flex items-center gap-2 transition-all shadow-lg hover:shadow-indigo-500/25"
                                    >
                                        <span>Export</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Processing Overlay */}
                    {isProcessing && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-blue-600 gap-4 cursor-wait">
                            <Loader2 className="w-12 h-12 animate-spin" />
                            <div className="text-center">
                                <p className="font-bold text-lg">Processing...</p>
                                <p className="text-sm opacity-80 mt-1">Please wait</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DndProvider>
    );
}
