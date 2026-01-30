'use client';
import React, { useEffect, useState } from 'react';
import { getRequests, deleteRequest } from '@/services/api';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';

const Dashboard = () => {
    const [requests, setRequests] = useState([]);
    const router = useRouter();

    useEffect(() => {
        const loadRequests = async () => {
            try {
                const data = await getRequests();
                setRequests(data);
            } catch (err) {
                console.error("Failed to load requests", err);
                // If unauthorized or other error, redirect to login
                // Ideally check err.response.status === 401
                router.push('/login');
            }
        };
        loadRequests();
    }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation(); // Prevent card click
        if (!confirm("Delete this request?")) return;
        try {
            await deleteRequest(id);
            setRequests(requests.filter(r => r.id !== id));
        } catch (err) {
            console.error(err);
            alert("Failed to delete request");
        }
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <NavBar />
            <div style={{ padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1>My Requests</h1>
                    <button className="btn-primary" onClick={() => router.push('/new-request')}>
                        + New Request
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                    {requests.map(req => (
                        <div
                            key={req.id}
                            className="glass-card"
                            style={{ padding: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s', position: 'relative' }}
                            onClick={() => router.push(`/requests/${req.id}`)}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                <span
                                    style={{ fontWeight: 'bold', color: 'var(--primary)', textDecoration: 'underline', zIndex: 10 }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/requests/${req.id}`);
                                    }}
                                >
                                    {req.display_id || req.id}
                                </span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span className={`status-badge status-${req.status}`}>
                                        {req.status}
                                    </span>
                                    <button
                                        onClick={(e) => handleDelete(e, req.id)}
                                        style={{
                                            background: 'transparent', border: 'none', color: '#ef4444',
                                            cursor: 'pointer', fontSize: '1.1rem', zIndex: 10
                                        }}
                                        title="Delete Request"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                <strong>From:</strong> {req.pickup_address}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                                <strong>To:</strong> {req.delivery_address}
                            </div>

                            <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{req.distance_km} km</span>
                                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>€{req.estimated_price}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {requests.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                        No requests found. Create one to get started!
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
