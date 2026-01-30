'use client';
import React, { useState } from 'react';
import { updateItem, deleteItem, addItem, api } from '@/services/api';

const ItemsTable = (props) => {
    const { requestId, initialItems, onUpdate, onItemClick, imageId } = props;
    const [items, setItems] = useState((initialItems || []).sort((a, b) => a.name.localeCompare(b.name)));

    // Sync with parent updates
    React.useEffect(() => {
        setItems((initialItems || []).sort((a, b) => a.name.localeCompare(b.name)));
    }, [initialItems]);

    const [newItem, setNewItem] = useState({
        name: '', quantity: 1, weight_kg: 0, width_cm: 0, height_cm: 0, depth_cm: 0, volume_m3: 0, image_id: initialItems?.[0]?.image_id || null
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [showResults, setShowResults] = useState(false);

    // Filter items
    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Separate items
    const aiItems = filteredItems.filter(i => i.bounding_box);
    const manualItems = filteredItems.filter(i => !i.bounding_box);

    // Controlled Edit State (Passed from parent)
    const {
        editingId, setEditingId,
        editValues, setEditValues,
        onEditSave, onEditCancel
    } = props; // Assuming props are passed, fallback to internal if needed? No, let's enforce controlled.


    const refreshItems = (updatedItems) => {
        const sorted = [...updatedItems].sort((a, b) => a.name.localeCompare(b.name));
        setItems(sorted);
        if (onUpdate) onUpdate(sorted);
    };

    // Start Editing
    const handleEditClick = (item) => {
        if (setEditingId && setEditValues) {
            setEditingId(item.id);
            setEditValues({ ...item });
        }
    };

    // Cancel Editing
    const handleCancelClick = () => {
        if (onEditCancel) onEditCancel();
    };

    const handleNameClick = (e, item) => {
        if (onItemClick) {
            onItemClick(item.id);
        }
    };

    // Save Changes
    const handleAcceptClick = async () => {
        if (onEditSave) {
            await onEditSave();
            // We expect parent to handle API and refresh
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteItem(id);
            const newItems = items.filter(i => i.id !== id);
            refreshItems(newItems);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAdd = async () => {
        try {
            const payload = { ...newItem, image_id: imageId };
            const added = await addItem(requestId, payload);
            const newItems = [...items, added];
            refreshItems(newItems);
            setNewItem({ name: '', quantity: 1, weight_kg: 0, width_cm: 0, height_cm: 0, depth_cm: 0 });
        } catch (err) {
            console.error(err);
            alert("Failed to add item");
        }
    };

    // Totals (based on filtered view)
    const itemsToSum = filteredItems;
    const totalQty = itemsToSum.reduce((acc, i) => acc + parseInt(i.quantity || 0), 0);
    const totalWeight = itemsToSum.reduce((acc, i) => acc + (parseFloat(i.weight_kg || 0) * parseInt(i.quantity || 0)), 0);
    const totalVolume = itemsToSum.reduce((acc, i) => acc + (parseFloat(i.volume_m3 || 0) * parseInt(i.quantity || 0)), 0);

    return (
        <div>
            {/* Global Search Filter (Existing) */}
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-start' }}>
                <input
                    type="text"
                    placeholder="Filter current items..."
                    className="input-field"
                    style={{ width: '100%', maxWidth: '400px', margin: 0 }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* AI ITEMS TABLE */}
            {aiItems.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '0.5rem', opacity: 0.8 }}>Detected Items</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Name</th>
                                    <th style={{ padding: '8px' }}>Color</th>
                                    <th style={{ padding: '8px' }}>Qty</th>
                                    <th style={{ padding: '8px' }}>Vol (m³)</th>
                                    <th style={{ padding: '8px' }}>Weight (kg)</th>
                                    <th style={{ padding: '8px' }}>Description</th>
                                    <th style={{ padding: '8px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aiItems.map(item => (
                                    <ItemRow
                                        key={item.id}
                                        item={item}
                                        editingId={editingId}
                                        editValues={editValues}
                                        setEditValues={setEditValues}
                                        handleNameClick={handleNameClick}
                                        handleEditClick={handleEditClick}
                                        handleCancelClick={handleCancelClick}
                                        handleAcceptClick={handleAcceptClick}
                                        handleDelete={handleDelete}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ADD ITEMS MANUALLY SECTION */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Add Items Manually</h3>
                <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>

                    {/* Search Input */}
                    <div style={{ flex: 1, minWidth: '300px', position: 'relative' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', opacity: 0.7 }}>Item Name (Search DB)</label>
                        <input
                            className="input-field"
                            style={{ margin: 0, width: '100%' }}
                            placeholder="Type to search..."
                            value={newItem.name}
                            onChange={async (e) => {
                                const val = e.target.value;
                                setNewItem({ ...newItem, name: val });
                                if (val.length > 1) {
                                    try {
                                        const res = await api.get(`/requests/items/search?q=${val}`);
                                        setSearchResults(res.data);
                                        setShowResults(true);
                                    } catch (err) { console.error(err); }
                                } else {
                                    setShowResults(false);
                                }
                            }}
                            onFocus={() => newItem.name.length > 1 && setShowResults(true)}
                            onBlur={() => setTimeout(() => setShowResults(false), 200)}
                        />
                        {showResults && searchResults.length > 0 && (
                            <div style={{
                                position: 'absolute', top: '100%', left: 0, right: 0,
                                background: '#1e293b', border: '1px solid #334155',
                                zIndex: 50, maxHeight: '200px', overflowY: 'auto',
                                borderRadius: '0 0 8px 8px'
                            }}>
                                {searchResults.map(res => (
                                    <div
                                        key={res.id}
                                        style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #334155' }}
                                        onClick={() => {
                                            setNewItem({
                                                ...newItem,
                                                name: res.name,
                                                weight_kg: res.weight_kg,
                                                volume_m3: res.volume_m3
                                            });
                                            setShowResults(false);
                                        }}
                                        className="hover:bg-slate-700"
                                    >
                                        {res.name} <span style={{ fontSize: '0.8em', color: '#94a3b8' }}>({res.weight_kg}kg, {res.volume_m3}m³)</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quantity */}
                    <div style={{ width: '80px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', opacity: 0.7 }}>Qty</label>
                        <input
                            type="number"
                            className="input-field"
                            style={{ margin: 0, width: '100%' }}
                            value={newItem.quantity}
                            onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                        />
                    </div>

                    {/* Description */}
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', opacity: 0.7 }}>Description (Optional)</label>
                        <input
                            className="input-field"
                            style={{ margin: 0, width: '100%' }}
                            placeholder="Details..."
                            value={newItem.description || ''}
                            onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                        />
                    </div>

                    {/* Add Button */}
                    <button onClick={handleAdd} className="btn-primary" style={{ height: '42px', padding: '0 2rem' }}>Add</button>

                    {/* Readonly Info */}
                    {(newItem.weight_kg > 0 || newItem.volume_m3 > 0) && (
                        <div style={{ fontSize: '0.8rem', opacity: 0.6, paddingBottom: '12px' }}>
                            Stats: {newItem.weight_kg}kg / {newItem.volume_m3}m³
                        </div>
                    )}
                </div>
            </div>

            {/* MANUAL ITEMS TABLE */}
            {manualItems.length > 0 && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '0.5rem', opacity: 0.8 }}>Manually Added Items</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Name</th>
                                    <th style={{ padding: '8px' }}>Qty</th>
                                    <th style={{ padding: '8px' }}>Vol (m³)</th>
                                    <th style={{ padding: '8px' }}>Weight (kg)</th>
                                    <th style={{ padding: '8px' }}>Description</th>
                                    <th style={{ padding: '8px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {manualItems.map(item => (
                                    <ItemRow
                                        key={item.id}
                                        item={item}
                                        isManual={true}
                                        editingId={editingId}
                                        editValues={editValues}
                                        setEditValues={setEditValues}
                                        handleNameClick={handleNameClick}
                                        handleEditClick={handleEditClick}
                                        handleCancelClick={handleCancelClick}
                                        handleAcceptClick={handleAcceptClick}
                                        handleDelete={handleDelete}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TOTALS */}
            <div style={{
                marginTop: '1rem', padding: '1rem',
                background: 'rgba(59, 130, 246, 0.2)',
                borderRadius: '8px', fontWeight: 'bold',
                display: 'flex', justifyContent: 'space-between'
            }}>
                <span>TOTALS</span>
                <span>Qty: {totalQty}</span>
                <span>Vol: {totalVolume.toFixed(3)} m³</span>
                <span>Weight: {totalWeight.toFixed(1)} kg</span>
            </div>
        </div>
    );
};

// Extracted Row Component to avoid duplication
const ItemRow = ({ item, isManual, editingId, editValues, setEditValues, handleEditClick, handleCancelClick, handleAcceptClick, handleDelete, handleNameClick }) => {
    const isEditing = item.id === editingId;
    return (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {/* NAME */}
            <td style={{ padding: '8px' }}>
                {isEditing ? (
                    <input className="input-field" style={{ margin: 0, padding: '4px' }} value={editValues.name || ''} onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
                ) : <span>{item.name}</span>}
            </td>

            {/* COLOR (Only for AI items) */}
            {!isManual && (
                <td style={{ padding: '8px' }}>
                    {isEditing ? (
                        <input type="color" className="input-field" style={{ margin: 0, padding: 0, width: '40px', height: '40px' }} value={editValues.color || '#000000'} onChange={(e) => setEditValues({ ...editValues, color: e.target.value })} />
                    ) : (
                        <div onClick={(e) => handleNameClick(e, item)} style={{ width: '32px', height: '32px', background: item.color || '#cccccc', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer' }} title="Highlight" />
                    )}
                </td>
            )}

            {/* QTY */}
            <td style={{ padding: '8px' }}>
                {isEditing ? (
                    <input type="number" className="input-field" style={{ margin: 0, padding: '4px', width: '50px' }} value={editValues.quantity} onChange={(e) => setEditValues({ ...editValues, quantity: parseInt(e.target.value) || 0 })} />
                ) : <span>{item.quantity}</span>}
            </td>

            {/* VOL */}
            <td style={{ padding: '8px' }}>
                {/* Readonly in table? Or editable? User said Vol/Weight read only FROM DB, but in table probably editable if needed? I'll keep editable for now to maintain manual override if resizing */}
                {isEditing ? (
                    <input type="number" className="input-field" style={{ margin: 0, padding: '4px', width: '60px' }} value={editValues.volume_m3} onChange={(e) => setEditValues({ ...editValues, volume_m3: parseFloat(e.target.value) || 0 })} />
                ) : <span>{item.volume_m3}</span>}
            </td>

            {/* WEIGHT */}
            <td style={{ padding: '8px' }}>
                {isEditing ? (
                    <input type="number" className="input-field" style={{ margin: 0, padding: '4px', width: '60px' }} value={editValues.weight_kg} onChange={(e) => setEditValues({ ...editValues, weight_kg: parseFloat(e.target.value) || 0 })} />
                ) : <span>{item.weight_kg}</span>}
            </td>

            {/* DESC */}
            <td style={{ padding: '8px' }}>
                {isEditing ? (
                    <textarea className="input-field" style={{ margin: 0, padding: '4px', height: '60px', width: '200px' }} value={editValues.description || ''} onChange={(e) => setEditValues({ ...editValues, description: e.target.value })} />
                ) : <span style={{ fontSize: '0.85rem', color: '#ccc' }}>{item.description || '-'}</span>}
            </td>

            {/* ACTIONS */}
            <td style={{ padding: '8px' }}>
                {isEditing ? (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleAcceptClick} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer' }}>Save</button>
                        <button onClick={handleCancelClick} style={{ background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer' }}>Cancel</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleEditClick(item)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button onClick={() => handleDelete(item.id)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Delete">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                )}
            </td>
        </tr>
    );
};

export default ItemsTable;

