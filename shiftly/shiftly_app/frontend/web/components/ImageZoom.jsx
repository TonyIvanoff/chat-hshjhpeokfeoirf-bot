'use client';
import React, { useState, useRef } from 'react';

const ImageZoom = ({ src, alt, items, activeItemId, onCanvasClick, editingId, editValues, onBoxChange }) => {
    const [zoom, setZoom] = useState(1); // 1.0 to 3.0
    const [imgSize, setImgSize] = useState({ w: 0, h: 0 }); // Natural dimensions
    const containerRef = useRef(null);

    // Zoom/Dimension Logic
    const handleZoomChange = (e) => setZoom(parseFloat(e.target.value));
    const handleImageLoad = (e) => setImgSize({ w: e.target.naturalWidth, h: e.target.naturalHeight });
    const [containerSize, setContainerSize] = useState({ w: 1024, h: 768 });

    React.useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height });
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const getRenderDimensions = () => {
        if (imgSize.w === 0 || containerSize.w === 0) return { w: 0, h: 0 };
        const MAX_W = containerSize.w;
        const MAX_H = containerSize.h;
        const aspectRatio = imgSize.w / imgSize.h;
        const canvasRatio = MAX_W / MAX_H;
        let baseW, baseH;
        if (aspectRatio > canvasRatio) { baseW = MAX_W; baseH = MAX_W / aspectRatio; }
        else { baseH = MAX_H; baseW = MAX_H * aspectRatio; }
        return { w: baseW * zoom, h: baseH * zoom };
    };

    const { w: renderW, h: renderH } = getRenderDimensions();

    // --- Drag / Resize State ---
    const [dragState, setDragState] = useState(null); // { type: 'move'|'nw'|'ne'..., startX, startY, startBox }

    const getNativeCoords = (e) => {
        if (!imgSize.w || !renderW) return { x: 0, y: 0 };
        const rect = e.target.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const scale = imgSize.w / renderW;
        return { x: screenX * scale, y: screenY * scale };
    };

    const handleMouseDown = (e, type, overrideBox = null) => {
        if (!editingId || !editValues) return;
        e.preventDefault();
        e.stopPropagation();

        const box = overrideBox || getEditingBox();
        if (!box) return;

        setDragState({
            type,
            startX: e.clientX,
            startY: e.clientY,
            startBox: [...box] // Copy [y1, x1, y2, x2]
        });
    };

    const handleGlobalMouseMove = (e) => {
        if (!dragState) return;
        e.preventDefault();

        if (dragState.type === 'pan') {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            if (containerRef.current) {
                containerRef.current.scrollLeft = dragState.startScrollLeft - dx;
                containerRef.current.scrollTop = dragState.startScrollTop - dy;
            }
            return;
        }

        if (!editValues || !onBoxChange) return;

        const dx_screen = e.clientX - dragState.startX;
        const dy_screen = e.clientY - dragState.startY;

        // Convert screen delta to image delta
        const scale = imgSize.w / renderW;
        const dx = dx_screen * scale;
        const dy = dy_screen * scale;

        const [y1, x1, y2, x2] = dragState.startBox;
        let newBox = [y1, x1, y2, x2];

        if (dragState.type === 'move') {
            const w = x2 - x1;
            const h = y2 - y1;
            newBox = [y1 + dy, x1 + dx, y2 + dy, x2 + dx];
            // Clamp to boundaries? optionally
        }
        else if (dragState.type === 'nw') { newBox = [y1 + dy, x1 + dx, y2, x2]; }
        else if (dragState.type === 'ne') { newBox = [y1 + dy, x1, y2, x2 + dx]; }
        else if (dragState.type === 'sw') { newBox = [y1, x1 + dx, y2 + dy, x2]; }
        else if (dragState.type === 'se') { newBox = [y1, x1, y2 + dy, x2 + dx]; }

        // Normalize (ensure min size, no inversion)
        // If resize crosses, we might just stop or flip?
        // Let's enforce min size 10px
        let [ny1, nx1, ny2, nx2] = newBox;

        // Min Size Check logic would go here, simplistic wrapper:
        if (nx2 - nx1 < 10 && (dragState.type.includes('w') || dragState.type.includes('e'))) {
            if (dragState.type.includes('w')) nx1 = nx2 - 10; else nx2 = nx1 + 10;
        }
        if (ny2 - ny1 < 10 && (dragState.type.includes('n') || dragState.type.includes('s'))) {
            if (dragState.type.includes('n')) ny1 = ny2 - 10; else ny2 = ny1 + 10;
        }

        onBoxChange([ny1, nx1, ny2, nx2]);
    };

    const handleGlobalMouseUp = () => {
        if (dragState) setDragState(null);
    };

    // Attach global listeners for drag outside container
    React.useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        } else {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [dragState]);

    const getEditingBox = () => {
        if (!editValues || !editValues.bounding_box) return null;
        let b = editValues.bounding_box;
        if (Array.isArray(b) && Array.isArray(b[0])) return b[0]; // [[y,x,y,x]]
        if (Array.isArray(b)) return b; // [y,x,y,x]
        // If string, should have been parsed by parent, but check
        try {
            const parsed = JSON.parse(b);
            if (Array.isArray(parsed[0])) return parsed[0];
            return parsed;
        } catch (e) { return null; }
    };

    const currentEditBox = getEditingBox();

    const handleContainerMouseDown = (e) => {
        if (zoom <= 1) return;
        // e.preventDefault(); // Prevents focus? Maybe needed for drag.
        setDragState({
            type: 'pan',
            startX: e.clientX,
            startY: e.clientY,
            startScrollLeft: containerRef.current.scrollLeft,
            startScrollTop: containerRef.current.scrollTop
        });
    };

    return (
        <div style={{
            borderRadius: '12px',
            border: '1px solid var(--glass-border)',
            background: 'rgba(0,0,0,0.2)',
            marginBottom: '1.5rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Toolbar */}
            <div
                style={{
                    padding: '10px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'rgba(255,255,255,0.05)'
                }}
            >
                {editingId ? <span style={{ color: 'yellow' }}>✏️ Editing Frame</span> : <span style={{ color: 'var(--text-muted)' }}>Click edit in list to adjust frame</span>}
                <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.2)' }}></div>
                <span style={{ fontSize: '0.9rem' }}>Zoom: {Math.round(zoom * 100)}%</span>
                <input
                    type="range" min="1" max="3" step="0.1" value={zoom} onChange={handleZoomChange}
                    style={{ flex: 1, cursor: 'pointer' }}
                />
            </div>

            {/* Stage */}
            <div
                ref={containerRef}
                onClick={onCanvasClick}
                style={{
                    width: '100%', height: '600px', maxHeight: '75vh', overflow: 'auto',
                    position: 'relative',
                    cursor: zoom > 1 ? (dragState?.type === 'pan' ? 'grabbing' : 'grab') : 'default',
                    background: '#000',
                    display: 'flex',
                    alignItems: renderH < containerSize.h ? 'center' : 'flex-start',
                    justifyContent: renderW < containerSize.w ? 'center' : 'flex-start',
                    padding: renderW < containerSize.w ? 0 : '10px', // Optional padding when scrolling
                }}
                onMouseDown={handleContainerMouseDown}
            >
                <div style={{
                    width: renderW > 0 ? `${renderW}px` : 'auto',
                    height: renderH > 0 ? `${renderH}px` : 'auto',
                    position: 'relative', flexShrink: 0,
                }}>
                    <img
                        src={src} alt={alt} onLoad={handleImageLoad}
                        style={{ width: '100%', height: '100%', display: 'block', userSelect: 'none' }}
                        draggable={false}
                    />

                    {/* SVG Layer */}
                    {imgSize.w > 0 && renderW > 0 && (
                        <svg
                            viewBox={`0 0 ${imgSize.w} ${imgSize.h}`}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                        >
                            {/* Render Passive Items */}
                            {items && items.map((item, index) => {
                                if (item.id === editingId) return null; // Don't render static if editing
                                if (activeItemId && item.id !== activeItemId && !editingId) return null; // Focus mode logic

                                let boxes = item.bounding_box || item.box;
                                if (!boxes) return null;
                                if (typeof boxes === 'string') { try { boxes = JSON.parse(boxes); } catch (e) { return null; } }
                                if (!Array.isArray(boxes[0])) boxes = [boxes];

                                return boxes.map((box, bIndex) => {
                                    const [y1, x1, y2, x2] = box;
                                    return (
                                        <g key={`${item.id}-${bIndex}`}>
                                            <rect
                                                x={x1} y={y1} width={x2 - x1} height={y2 - y1}
                                                fill="none" stroke={item.color || '#00ff00'}
                                                strokeWidth={Math.max(3, imgSize.w / 300)}
                                            />
                                            {(activeItemId === item.id) && (
                                                <text x={x1} y={y1 - 5} fill={item.color} fontSize={Math.max(12, imgSize.w / 50)} fontWeight="bold">
                                                    {item.name}
                                                </text>
                                            )}
                                        </g>
                                    );
                                });
                            })}

                            {/* Render EDITING Item */}
                            {currentEditBox && editingId && (
                                <g>
                                    <rect
                                        x={currentEditBox[1]} y={currentEditBox[0]}
                                        width={currentEditBox[3] - currentEditBox[1]}
                                        height={currentEditBox[2] - currentEditBox[0]}
                                        fill="rgba(255, 255, 0, 0.1)"
                                        stroke="yellow"
                                        strokeWidth={Math.max(3, imgSize.w / 300)}
                                        strokeDasharray="5,5"
                                        onMouseDown={(e) => handleMouseDown(e, 'move', currentEditBox)}
                                        style={{ cursor: 'move' }}
                                    />
                                    {/* Handles */}
                                    {[
                                        { type: 'nw', cx: currentEditBox[1], cy: currentEditBox[0] },
                                        { type: 'ne', cx: currentEditBox[3], cy: currentEditBox[0] },
                                        { type: 'sw', cx: currentEditBox[1], cy: currentEditBox[2] },
                                        { type: 'se', cx: currentEditBox[3], cy: currentEditBox[2] }
                                    ].map(h => {
                                        const size = Math.max(10, imgSize.w / 100);
                                        return (
                                            <rect
                                                key={h.type}
                                                x={h.cx - size / 2} y={h.cy - size / 2}
                                                width={size} height={size}
                                                fill="yellow" stroke="black" strokeWidth={1}
                                                style={{ cursor: `${h.type}-resize` }}
                                                onMouseDown={(e) => handleMouseDown(e, h.type, currentEditBox)}
                                            />
                                        );
                                    })}
                                </g>
                            )}
                        </svg>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImageZoom;
