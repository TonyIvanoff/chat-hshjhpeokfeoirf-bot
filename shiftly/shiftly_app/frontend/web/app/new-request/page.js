'use client';
import React, { useState } from 'react';
import { createRequest, uploadImage, analyzeRequest } from '@/services/api';
import { useRouter } from 'next/navigation';
import ItemsTable from '@/components/ItemsTable';
import ImageZoom from '@/components/ImageZoom';

const NewRequest = () => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [pickup, setPickup] = useState('');
    const [delivery, setDelivery] = useState('');

    // Request Data from Backend
    const [requestData, setRequestData] = useState(null);
    const [aiResult, setAiResult] = useState(null);
    const [activeItemId, setActiveItemId] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    // Edit State (Lifted from ItemsTable)
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});

    const router = useRouter();

    // Step 1: Submit Addresses & Create Request
    const handleAddressSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await createRequest({
                pickup_address: pickup,
                delivery_address: delivery
            });
            setRequestData(data);
            setStep(2);
        } catch (err) {
            console.error(err);
            alert("Failed to create request");
        }
        setLoading(false);
    };

    // Step 3: Upload Image
    // Step 3: Multi-Image Upload
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploading, setUploading] = useState(false);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (selectedFiles.length + files.length > 20) {
            alert("You can only upload up to 20 photos.");
            return;
        }
        setSelectedFiles(prev => [...prev, ...files]);
    };

    const handleRemoveFile = (index) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleNextStep = async () => {
        if (selectedFiles.length === 0) return;

        setLoading(true);
        setUploading(true);
        try {
            // 1. Upload all images without analysis
            const uploadPromises = selectedFiles.map(file => uploadImage(requestData.id, file, false));
            await Promise.all(uploadPromises);

            // 2. Trigger Batch Analysis
            const result = await analyzeRequest(requestData.id);
            setAiResult(result);
            setStep(4);
        } catch (err) {
            console.error(err);
            alert("Failed to process images: " + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>New Removal Request</h1>

            {/* Progress Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3rem', position: 'relative' }}>
                {[1, 2, 3, 4].map(s => (
                    <div key={s} style={{
                        width: '40px', height: '40px',
                        borderRadius: '50%',
                        background: step >= s ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold',
                        zIndex: 1
                    }}>
                        {s}
                    </div>
                ))}
                <div style={{
                    position: 'absolute', top: '20px', left: '0', right: '0', height: '2px',
                    background: 'rgba(255,255,255,0.1)', zIndex: 0
                }}>
                    <div style={{
                        width: `${((step - 1) / 3) * 100}%`, height: '100%',
                        background: 'var(--primary)',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
            </div>

            <div className="glass-card" style={{ padding: '2rem' }}>
                {loading && <div style={{ textAlign: 'center', marginBottom: '1rem', color: 'var(--accent)' }}>Processing...</div>}

                {step === 1 && (
                    <form onSubmit={handleAddressSubmit}>
                        <h3>Where should we move you?</h3>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Pickup Address</label>
                            <input className="input-field" value={pickup} onChange={e => setPickup(e.target.value)} required />
                        </div>
                        <div style={{ marginBottom: '2rem' }}>
                            <label>Delivery Address</label>
                            <input className="input-field" value={delivery} onChange={e => setDelivery(e.target.value)} required />
                        </div>
                        <button className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                            Calculate Route
                        </button>
                        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => router.push('/dashboard')}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                Back to Dashboard
                            </button>
                        </div>
                    </form>
                )}

                {step === 2 && requestData && (
                    <div>
                        <h3 style={{ marginBottom: '1.5rem' }}>Route Summary</h3>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', marginBottom: '1rem' }}>
                            <span>Distance:</span>
                            <b>{requestData.distance_km} km</b>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', marginBottom: '2rem', color: 'var(--primary)' }}>
                            <span>Estimated Price:</span>
                            <b>€{requestData.estimated_price}</b>
                        </div>
                        <button className="btn-primary" style={{ width: '100%' }} onClick={() => setStep(3)}>
                            Proceed to Items
                        </button>
                    </div>
                )}

                {step === 3 && (
                    <div style={{ textAlign: 'center' }}>
                        <h3>Upload Item Photos</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                            Upload up to 20 photos. Our AI will analyze them all at once.
                        </p>

                        <div style={{
                            border: '2px dashed var(--glass-border)',
                            borderRadius: '16px',
                            padding: '2rem',
                            marginBottom: '2rem',
                            cursor: 'pointer',
                            background: 'rgba(255,255,255,0.02)'
                        }}>
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                                style={{ display: 'none' }}
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block', width: '100%', height: '100%' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>📸</div>
                                <div style={{ fontWeight: 'bold' }}>Click to Add Photos</div>
                                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {selectedFiles.length} / 20 selected
                                </div>
                            </label>
                        </div>

                        {/* Image Previews */}
                        {selectedFiles.length > 0 && (
                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem', marginBottom: '2rem'
                            }}>
                                {selectedFiles.map((file, idx) => (
                                    <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden' }}>
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt="preview"
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <button
                                            onClick={() => handleRemoveFile(idx)}
                                            style={{
                                                position: 'absolute', top: '4px', right: '4px',
                                                background: 'rgba(0,0,0,0.6)', color: 'white',
                                                border: 'none', borderRadius: '50%',
                                                width: '24px', height: '24px', cursor: 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            className="btn-primary"
                            style={{ width: '100%' }}
                            onClick={handleNextStep}
                            disabled={loading || selectedFiles.length === 0}
                        >
                            {loading ? (uploading ? "Uploading & Analyzing..." : "Processing...") : "Next: Analyze Items"}
                        </button>
                    </div>
                )}

                {step === 4 && aiResult && (
                    <div onClick={() => setActiveItemId(null)}> {/* Click outside to reset */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Review Items</h3>

                            {/* Pagination Controls */}
                            {aiResult.images && aiResult.images.length > 1 && (
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <button
                                        className="btn-primary"
                                        style={{ padding: '0.5rem 1rem', background: currentImageIndex === 0 ? 'rgba(255,255,255,0.1)' : undefined }}
                                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => Math.max(0, prev - 1)); }}
                                        disabled={currentImageIndex === 0}
                                    >
                                        ← Prev
                                    </button>
                                    <span>
                                        Image {currentImageIndex + 1} of {aiResult.images.length}
                                    </span>
                                    <button
                                        className="btn-primary"
                                        style={{ padding: '0.5rem 1rem', background: currentImageIndex === aiResult.images.length - 1 ? 'rgba(255,255,255,0.1)' : undefined }}
                                        onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(prev => Math.min(aiResult.images.length - 1, prev + 1)); }}
                                        disabled={currentImageIndex === aiResult.images.length - 1}
                                    >
                                        Next →
                                    </button>
                                </div>
                            )}
                        </div>

                        {aiResult.images && aiResult.images.length > 0 && (() => {
                            const currentImg = aiResult.images[currentImageIndex];
                            // Filter items for this image
                            const currentItems = aiResult.items.filter(item => item.image_id === currentImg.id);

                            return (
                                <div key={currentImg.id}>
                                    {/* Image View */}
                                    <div style={{ marginBottom: '2rem' }}>
                                        <ImageZoom
                                            src={`http://localhost:8000/${currentImg.file_path}`}
                                            alt={`Analysis ${currentImg.id}`}
                                            items={currentItems}
                                            activeItemId={activeItemId}
                                            onCanvasClick={() => setActiveItemId(null)}

                                            // Edit Props
                                            editingId={editingId}
                                            editValues={editValues}
                                            onBoxChange={(newBox) => {
                                                // newBox is [y1, x1, y2, x2]
                                                // We update the editValues state so the frame moves visually
                                                // We treat the box as a string array for the payload or just array? 
                                                // The Item model has bounding_box as String(JSON).
                                                // But editValues should probably keep it raw until save?
                                                // Existing item.bounding_box is likely an array (from backend JSON parse?) 
                                                // Wait, backend schemas.py ItemOut defines bounding_box as Any or List.
                                                // Let's check API response... usually it comes as parsed JSON if we use a Pydantic model with Json field or we parsing it manual.
                                                // In front-end, we iterate map(item.bounding_box || item.box).
                                                // So it's an array of array(s).
                                                // We'll standardise that editValues.bounding_box is [[y1, x1, y2, x2]] or [y1, x1, y2, x2]?
                                                // ItemsTable editValues comes from {...item}. item.bounding_box is [[y1, x1, y2, x2]].
                                                // So update it as such.
                                                setEditValues(prev => ({
                                                    ...prev,
                                                    bounding_box: [newBox] // Array of boxes
                                                }));
                                            }}
                                        />
                                    </div>

                                    {/* Item List for this Image */}
                                    <div onClick={(e) => e.stopPropagation()}>
                                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>Detected & Manual Items</h4>
                                        <ItemsTable
                                            requestId={requestData.id}
                                            initialItems={currentItems}
                                            imageId={currentImg.id}
                                            onItemClick={(id) => setActiveItemId(id === activeItemId ? null : id)}

                                            // Controlled Edit Props
                                            editingId={editingId}
                                            setEditingId={setEditingId}
                                            editValues={editValues}
                                            setEditValues={setEditValues}
                                            onEditCancel={() => {
                                                setEditingId(null);
                                                setEditValues({});
                                            }}
                                            onEditSave={async () => {
                                                try {
                                                    // Ensure bounding_box is stringified if backend expects string
                                                    // Backend ItemCreate expects bounding_box as "str" or List?
                                                    // The backend model is String. The payload usually JSON string.
                                                    // However, requests.py:513 uses item_in.bounding_box directly.
                                                    // If Pydantic model says str, we must stringify.
                                                    // Let's check services/api.js updateItem.
                                                    // For safety, let's send it as is, and let axios/backend handle? 
                                                    // Actually, previously we did JSON.stringify([box]).
                                                    // If editValues has array, we might need to stringify.

                                                    const payload = { ...editValues };
                                                    if (Array.isArray(payload.bounding_box)) {
                                                        payload.bounding_box = JSON.stringify(payload.bounding_box);
                                                    }

                                                    const { updateItem } = await import('@/services/api');
                                                    const updated = await updateItem(editingId, payload);

                                                    // Update master list
                                                    setAiResult(prev => ({
                                                        ...prev,
                                                        items: prev.items.map(i => i.id === editingId ? updated : i)
                                                    }));

                                                    setEditingId(null);
                                                    setEditValues({});
                                                } catch (err) {
                                                    console.error("Save failed", err);
                                                    alert("Failed to save changes.");
                                                }
                                            }}
                                            onUpdate={(updatedList) => {
                                                // This handles updates from Adds/Deletes inside ItemsTable
                                                // We merge the updated list for THIS image back into aiResult
                                                const otherItems = aiResult.items.filter(i => i.image_id !== currentImg.id);
                                                setAiResult(prev => ({
                                                    ...prev,
                                                    items: [...otherItems, ...updatedList]
                                                }));
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}

                        <button className="btn-primary" style={{ width: '100%', marginTop: '3rem' }} onClick={(e) => { e.stopPropagation(); router.push('/dashboard'); }}>
                            Finish & View Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewRequest;
