'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getRequest, getProfile, updateItem } from '@/services/api';
import ItemsTable from '@/components/ItemsTable';
import ImageZoom from '@/components/ImageZoom';

const RequestDetails = () => {
    // Note: in Next.js App Router, params are passed as props to the page component.
    // However, since we are using 'use client', we can use useParams() hook from next/navigation.
    const params = useParams();
    const id = params.id;

    const router = useRouter();
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeItemId, setActiveItemId] = useState(null);
    const [userRole, setUserRole] = useState(null);

    // Edit State for ItemsTable
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({});

    const fetchRequest = async () => {
        try {
            // Fetch request and user profile in parallel
            const [requestData, profileData] = await Promise.all([
                getRequest(id),
                getProfile().catch(err => null) // failures to get profile shouldn't block view, but means no role info
            ]);

            setRequest(requestData);
            if (profileData) {
                setUserRole(profileData.role);
            }
        } catch (err) {
            console.error("Failed to fetch data", err);
            // alert("Request not found"); // Removing alert as it can be annoying
            alert("Request not found or access denied");
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchRequest();
        }
    }, [id]);

    // Pagination State (Moved up to avoid Hook errors)
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const images = request?.images || [];
    const hasImages = images.length > 0;

    // Derived Data for Current View
    // View modes: 0..N-1 (Images), N (Unassigned/General if any exist)
    const unassignedItems = (request?.items || []).filter(i => !i.image_id);
    const hasUnassigned = unassignedItems.length > 0;

    // Total pages = Images + (1 if unassigned items exist)
    // If no images, just 1 page (General)
    const totalPages = hasImages ? (images.length + (hasUnassigned ? 1 : 0)) : 1;

    // Ensure index valid
    useEffect(() => {
        if (currentImageIndex >= totalPages && totalPages > 0) {
            setCurrentImageIndex(0);
        }
    }, [totalPages, currentImageIndex]);

    if (loading) return <div style={{ padding: '2rem', color: 'white' }}>Loading...</div>;
    if (!request) return null;

    const getCurrentViewData = () => {
        if (!hasImages) {
            // No images uploaded, show everything as "General"
            return {
                title: "General Items (No Images)",
                imageUrl: null,
                items: request.items || [],
                imageId: null,
                isUnassignedView: true
            };
        }

        if (currentImageIndex < images.length) {
            // Image View
            const img = images[currentImageIndex];
            const itemsForImage = (request.items || []).filter(i => i.image_id === img.id);
            return {
                title: `Image ${currentImageIndex + 1} of ${images.length}`,
                imageUrl: `http://localhost:8000/${img.file_path}`,
                items: itemsForImage,
                imageId: img.id,
                isUnassignedView: false
            };
        } else {
            // Unassigned View (Last page)
            return {
                title: "Unassigned / General Items",
                imageUrl: null, // No image for this view
                items: unassignedItems,
                imageId: null,
                isUnassignedView: true
            };
        }
    };

    const viewData = getCurrentViewData();

    // Handlers
    const handleNext = () => {
        if (currentImageIndex < totalPages - 1) setCurrentImageIndex(prev => prev + 1);
    };

    const handlePrev = () => {
        if (currentImageIndex > 0) setCurrentImageIndex(prev => prev - 1);
    };

    // Update handler to refresh local items when ItemsTable changes
    const handleItemsUpdate = (updatedPageItems) => {
        // We receive updated items ONLY for the current page.
        // We need to merge this back into the full request.items list.
        // Actually, ItemsTable locally manages its state, but here we might want to refetch or merge?
        // Current implementation of ItemsTable calls API directly (addItem, deleteItem).
        // It calls onUpdate(sortedItems) but that's mostly for parent to know.
        // Ideally we should update 'request.items' so switching pages and back keeps data consistent.

        setRequest(prev => {
            const otherItems = prev.items.filter(i =>
                viewData.imageId ? i.image_id !== viewData.imageId : i.image_id // if current view has imageId, keep others. if current is unassigned (null), keep those with imageId
            );
            return { ...prev, items: [...otherItems, ...updatedPageItems] };
        });
    };

    const handleEditSave = async () => {
        try {
            const updated = await updateItem(editingId, editValues);

            // Update local state
            setRequest(prev => {
                const newItems = prev.items.map(i => i.id === editingId ? updated : i);
                return { ...prev, items: newItems };
            });

            setEditingId(null);
            setEditValues({});
        } catch (err) {
            console.error("Failed to update item", err);
            alert("Failed to update item");
        }
    };

    const handleEditCancel = () => {
        setEditingId(null);
        setEditValues({});
    };

    // Determine Back Link
    const isAdmin = userRole === 'admin' || userRole === 'superuser';
    const backLink = isAdmin ? '/admin?tab=requests' : '/dashboard';

    return (
        <div style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <button
                    onClick={() => router.push(backLink)}
                    className="btn-primary"
                    style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)', fontWeight: 'bold' }}
                >
                    ← Back to Dashboard
                </button>
                <h1 style={{ margin: 0 }}>{request.display_id || request.id}</h1>
            </div>

            <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                {/* Header Info */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>

                    <div style={{ display: 'flex', gap: '2rem' }}>
                        <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Status</span>
                            <span className={`status-badge status-${request.status}`}>
                                {request.status}
                            </span>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block' }}>Total Items</span>
                            <span style={{ fontWeight: 'bold' }}>{request.items?.length || 0}</span>
                        </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            €{request.estimated_price}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Est. Total Price</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    <div>
                        <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Pickup From</h3>
                        <p style={{ fontSize: '1.1rem' }}>{request.pickup_address}</p>
                    </div>
                    <div>
                        <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Delivery To</h3>
                        <p style={{ fontSize: '1.1rem' }}>{request.delivery_address}</p>
                    </div>
                </div>


                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <button
                            onClick={handlePrev}
                            disabled={currentImageIndex === 0}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                                background: currentImageIndex === 0 ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                                color: currentImageIndex === 0 ? 'var(--text-muted)' : 'white',
                                cursor: currentImageIndex === 0 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Previous
                        </button>
                        <span style={{ fontWeight: '600' }}>
                            {currentImageIndex + 1} / {totalPages}
                        </span>
                        <button
                            onClick={handleNext}
                            disabled={currentImageIndex === totalPages - 1}
                            style={{
                                padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)',
                                background: currentImageIndex === totalPages - 1 ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                                color: currentImageIndex === totalPages - 1 ? 'var(--text-muted)' : 'white',
                                cursor: currentImageIndex === totalPages - 1 ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Next
                        </button>
                    </div>
                )}

                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', textAlign: 'center' }}>{viewData.title}</h2>

                {/* Image Section */}
                {viewData.imageUrl ? (
                    <div style={{ marginBottom: '2rem' }}>
                        <div onClick={() => setActiveItemId(null)}>
                            <ImageZoom
                                src={viewData.imageUrl}
                                alt="Annotated Items"
                                items={viewData.items}
                                activeItemId={activeItemId}
                                onCanvasClick={() => setActiveItemId(null)}

                                // Edit Props
                                editingId={editingId}
                                editValues={editValues}
                                onBoxChange={(newBox) => {
                                    // Ensure we match the structure (List[List[float]])
                                    setEditValues(prev => ({
                                        ...prev,
                                        bounding_box: [newBox]
                                    }));
                                }}
                            />
                        </div>
                    </div>
                ) : (
                    hasImages && viewData.isUnassignedView && (
                        <div style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '2rem', color: 'var(--text-muted)' }}>
                            No specific image for these items (Manually added without image context)
                        </div>
                    )
                )}

                {/* Items Table for Current Page */}
                <h3 style={{ marginBottom: '1rem' }}>Items in this view</h3>
                <ItemsTable
                    requestId={request.id}
                    initialItems={viewData.items}
                    imageId={viewData.imageId} // Pass current image ID for new items
                    onUpdate={handleItemsUpdate}
                    onItemClick={(id) => setActiveItemId(id === activeItemId ? null : id)}

                    // Edit Props
                    editingId={editingId}
                    setEditingId={setEditingId}
                    editValues={editValues}
                    setEditValues={setEditValues}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                />
            </div>
        </div>
    );
};

export default RequestDetails;
