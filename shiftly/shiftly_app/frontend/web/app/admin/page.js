'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getUsers, updateUser, getProfile, createUser, deleteUser, getAllRequests, deleteRequestAdmin, getModules, getModuleVersions, manageModule, getTrainingStats, startTraining, getTrainingHistory } from '@/services/api';
import Navbar from '@/components/NavBar';

const AdminDashboard = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);

    // activeTab derived from URL, default 'users'
    const currentTab = searchParams.get('tab') || 'users';
    const [activeTab, setActiveTabState] = useState(currentTab);

    // Sync state if URL changes externally (e.g. back button)
    useEffect(() => {
        setActiveTabState(currentTab);
    }, [currentTab]);

    const setActiveTab = (tab) => {
        setActiveTabState(tab);
        const params = new URLSearchParams(searchParams);
        params.set('tab', tab);
        router.push(`${pathname}?${params.toString()}`);
    };



    // User & Request Vars
    const [users, setUsers] = useState([]);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', role: 'client' });

    const [requests, setRequests] = useState([]);
    const [requestSearch, setRequestSearch] = useState('');

    // Module Vars
    const [modules, setModules] = useState({ backend: [], frontend: [] });
    const [loadingModules, setLoadingModules] = useState(false);
    const [showDowngradeModal, setShowDowngradeModal] = useState(false);
    const [selectedModule, setSelectedModule] = useState(null);
    const [moduleVersions, setModuleVersions] = useState([]);
    const [moduleSearch, setModuleSearch] = useState('');

    // Progress Bar State
    const [updatingModule, setUpdatingModule] = useState(null); // { name, type, action }
    const [progress, setProgress] = useState(0); // 0-100

    // Additional Module Vars
    const [history, setHistory] = useState([]);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [pageBackend, setPageBackend] = useState(1);
    const [pageFrontend, setPageFrontend] = useState(1);
    const [pageHistory, setPageHistory] = useState(1);
    const [pageOutdatedFrontend, setPageOutdatedFrontend] = useState(1);
    const [pageOutdatedBackend, setPageOutdatedBackend] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const OUTDATED_ITEMS_PER_PAGE = 5;

    // Price Table State
    const [editingPriceIdx, setEditingPriceIdx] = useState(null);
    const [editingAdditionalIdx, setEditingAdditionalIdx] = useState(null);

    // AI Training State
    const [trainingStats, setTrainingStats] = useState(null);
    const [trainingHistory, setTrainingHistory] = useState([]);
    const [trainingTotal, setTrainingTotal] = useState(0);
    const [trainingPage, setTrainingPage] = useState(1);
    const [isTrainingStarting, setIsTrainingStarting] = useState(false);

    // AI Training Handlers
    const fetchTrainingData = async () => {
        try {
            const stats = await getTrainingStats();
            setTrainingStats(stats);
            await fetchTrainingHistory(1);
        } catch (error) {
            console.error("Error fetching training data", error);
        }
    }

    const fetchTrainingHistory = async (page) => {
        try {
            const data = await getTrainingHistory(page, 10);
            setTrainingHistory(data.items);
            setTrainingTotal(data.total);
            setTrainingPage(page);
        } catch (error) {
            console.error("Error fetching training history", error);
        }
    }

    useEffect(() => {
        if (activeTab === 'training') {
            fetchTrainingData();
        }
    }, [activeTab]);

    const handleStartTraining = async () => {
        if (!confirm("Start AI Model Training? This may take several minutes.")) return;

        setIsTrainingStarting(true);
        try {
            await startTraining();
            alert("Training started in background!");
            setTimeout(() => fetchTrainingHistory(1), 1000);
        } catch (error) {
            alert("Failed to start training: " + (error.response?.data?.detail || error.message));
        } finally {
            setIsTrainingStarting(false);
        }
    }

    useEffect(() => {
        const checkAuthAndFetch = async () => {
            try {
                // 1. Check Role
                const profile = await getProfile();
                if (profile.role !== 'admin') {
                    router.push('/access-restricted');
                    return;
                }

                // 2. Fetch Users
                const userData = await getUsers();
                setUsers(userData);

                // 3. Fetch Requests
                const reqData = await getAllRequests();
                setRequests(reqData);

            } catch (err) {
                console.error("Admin Access Error", err);
                router.push('/access-restricted');
            } finally {
                setLoading(false);
            }
        };
        checkAuthAndFetch();
    }, []);

    // --- User Handlers ---
    const handleEditClick = (user) => {
        setEditingUser(user.id);
        setEditForm({ ...user });
    };

    const handleCancelEdit = () => {
        setEditingUser(null);
        setEditForm({});
    };

    const handleSave = async () => {
        try {
            await updateUser(editingUser, editForm);
            setUsers(users.map(u => u.id === editingUser ? { ...editForm, id: u.id } : u));
            setEditingUser(null);
        } catch (err) {
            console.error(err);
            alert("Failed to update user");
        }
    };

    const handleDelete = async (userId) => {
        if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
        try {
            await deleteUser(userId);
            setUsers(users.filter(u => u.id !== userId));
        } catch (err) {
            console.error(err);
            alert("Failed to delete user: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        try {
            const created = await createUser(newUser);
            setUsers([...users, created]);
            setShowCreateModal(false);
            setNewUser({ full_name: '', email: '', password: '', role: 'client' });
        } catch (err) {
            console.error(err);
            alert("Failed to create user: " + (err.response?.data?.detail || err.message));
        }
    };

    // --- Request Handlers ---
    const handleRequestSearch = async (e) => {
        e.preventDefault();
        try {
            const data = await getAllRequests(requestSearch);
            setRequests(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleDeleteRequest = async (reqId) => {
        if (!confirm("Delete this request properly?")) return;
        try {
            await deleteRequestAdmin(reqId);
            setRequests(requests.filter(r => r.id !== reqId));
        } catch (err) {
            console.error(err);
            alert("Failed to delete request");
        }
    };

    // --- Module Handlers ---

    useEffect(() => {
        if (activeTab === 'modules') {
            fetchModules();
            fetchHistory();
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'modules') {
            fetchHistory();
        }
    }, [pageHistory]);

    const fetchModules = async () => {
        setLoadingModules(true);
        try {
            const data = await getModules();
            setModules(data);
        } catch (err) {
            console.error(err);
            alert("Failed to fetch modules");
        } finally {
            setLoadingModules(false);
        }
    };

    const fetchHistory = async () => {
        try {
            const data = await getModuleHistory(pageHistory, ITEMS_PER_PAGE);
            setHistory(data.items || []);
            setHistoryTotal(data.total || 0);
        } catch (err) {
            console.error("Failed to fetch history", err);
        }
    }

    // Import new API function
    const { getModuleHistory, startModuleJob, getJobStatus } = require('@/services/api');

    const handleModuleUpdate = async (type, name) => {
        if (!confirm(`Update ${name} to latest version?`)) return;
        setLoadingModules(true);

        try {
            const { job_id } = await startModuleJob(type, name, 'update');
            setUpdatingModule({ name, type, action: 'Updating', jobId: job_id, progress: 0 });

            // Poll for status
            const interval = setInterval(async () => {
                try {
                    const status = await getJobStatus(job_id);
                    setUpdatingModule(prev => prev ? ({ ...prev, progress: status.progress, log: status.log }) : null);

                    if (status.status === 'completed') {
                        clearInterval(interval);
                        alert(`${name} updated successfully!`);
                        setUpdatingModule(null);
                        setLoadingModules(false);
                        fetchModules();
                        fetchHistory();
                    } else if (status.status === 'failed') {
                        clearInterval(interval);
                        setUpdatingModule(null);
                        setLoadingModules(false);
                        alert("Update failed: " + status.log);
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 1000);

        } catch (err) {
            console.error(err);
            alert("Failed to start update: " + (err.response?.data?.detail || err.message));
            setLoadingModules(false);
        }
    };

    const handleDowngradeClick = async (type, name) => {
        setSelectedModule({ type, name });
        setModuleVersions([]);
        setShowDowngradeModal(true);
        try {
            const versions = await getModuleVersions(type, name);
            setModuleVersions(versions);
        } catch (err) {
            console.error(err);
            alert("Failed to fetch versions");
        }
    };

    const handleDowngradeConfirm = async (mod, version) => {
        if (!confirm(`Downgrade ${mod.name} to ${version}?`)) return;
        setLoadingModules(true);
        setShowDowngradeModal(false);

        try {
            const { job_id } = await startModuleJob(mod.type, mod.name, 'install', version);
            setUpdatingModule({ name: mod.name, type: mod.type, action: 'Downgrading', jobId: job_id, progress: 0 });

            // Poll for status
            const interval = setInterval(async () => {
                try {
                    const status = await getJobStatus(job_id);
                    setUpdatingModule(prev => prev ? ({ ...prev, progress: status.progress, log: status.log }) : null);

                    if (status.status === 'completed') {
                        clearInterval(interval);
                        alert(`${mod.name} downgraded successfully!`);
                        setUpdatingModule(null);
                        setLoadingModules(false);
                        fetchModules();
                        fetchHistory();
                    } else if (status.status === 'failed') {
                        clearInterval(interval);
                        setUpdatingModule(null);
                        setLoadingModules(false);
                        alert("Downgrade failed: " + status.log);
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 1000);

        } catch (err) {
            console.error(err);
            alert("Downgrade failed: " + (err.response?.data?.detail || err.message));
            setLoadingModules(false);
        }
    };

    // Derived State for UI
    const outdatedBackend = modules.backend.filter(m => m.version !== m.latest);
    const outdatedFrontend = modules.frontend.filter(m => m.version !== m.latest);

    const filteredBackend = modules.backend.filter(m => m.name.toLowerCase().includes(moduleSearch.toLowerCase()));
    const filteredFrontend = modules.frontend.filter(m => m.name.toLowerCase().includes(moduleSearch.toLowerCase()));

    const paginatedBackend = filteredBackend.slice((pageBackend - 1) * ITEMS_PER_PAGE, pageBackend * ITEMS_PER_PAGE);
    const paginatedFrontend = filteredFrontend.slice((pageFrontend - 1) * ITEMS_PER_PAGE, pageFrontend * ITEMS_PER_PAGE);

    if (loading) return <div style={{ color: 'white', padding: '2rem' }}>Loading Admin Panel...</div>;

    return (
        <div>
            <Navbar />
            <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ margin: 0 }}>Admin Dashboard</h1>
                    {activeTab === 'users' && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn-primary"
                        >
                            + Create User
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)' }}>
                    {/* ... (Existing Tabs Reuse) ... */}
                    <button onClick={() => setActiveTab('users')} style={{ padding: '1rem 2rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : 'none', color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer' }}>Users</button>
                    <button onClick={() => setActiveTab('requests')} style={{ padding: '1rem 2rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'requests' ? '2px solid var(--primary)' : 'none', color: activeTab === 'requests' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer' }}>Requests</button>
                    <button onClick={() => setActiveTab('modules')} style={{ padding: '1rem 2rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'modules' ? '2px solid var(--primary)' : 'none', color: activeTab === 'modules' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer' }}>Modules</button>
                    <button onClick={() => setActiveTab('prices')} style={{ padding: '1rem 2rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'prices' ? '2px solid var(--primary)' : 'none', color: activeTab === 'prices' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer' }}>Price Table</button>
                    <button onClick={() => setActiveTab('training')} style={{ padding: '1rem 2rem', background: 'transparent', border: 'none', borderBottom: activeTab === 'training' ? '2px solid var(--primary)' : 'none', color: activeTab === 'training' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer' }}>AI Training</button>
                </div>

                {/* --- USERS & REQUESTS TABS (Hidden for brevity in this replace block, need to keep them or strictly target modules) --- */}
                {/* To avoid deleting Users/Requests code, I need to match carefully. 
                    The tool call covers the whole return and helper functions. 
                    I'll reconstruct the whole return block to be safe. 
                */}

                {activeTab === 'users' && (
                    <>
                        {showCreateModal && (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                                <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '500px' }}>
                                    <h2 style={{ marginBottom: '1.5rem' }}>Create New User</h2>
                                    <form onSubmit={handleCreateUser}>
                                        <div style={{ marginBottom: '1rem' }}><label>Full Name</label><input className="input-field" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} required /></div>
                                        <div style={{ marginBottom: '1rem' }}><label>Email</label><input type="email" className="input-field" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required /></div>
                                        <div style={{ marginBottom: '1rem' }}><label>Password</label><input type="password" className="input-field" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required /></div>
                                        <div style={{ marginBottom: '2rem' }}><label>Role</label><select className="input-field" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}><option value="client">Client</option><option value="provider">Provider</option><option value="superuser">Superuser</option><option value="admin">Admin</option></select></div>
                                        <div style={{ display: 'flex', gap: '1rem' }}><button type="submit" className="btn-primary" style={{ flex: 1 }}>Create</button><button type="button" onClick={() => setShowCreateModal(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', borderRadius: '12px', cursor: 'pointer' }}>Cancel</button></div>
                                    </form>
                                </div>
                            </div>
                        )}
                        <div className="glass-card" style={{ overflowX: 'auto' }}>
                            {/* Re-render User Table (omitted for brevity in prompt context, but must exist in real file) */}
                            {/* NOTE: I cannot emit partial file here easily without targeting blocks. 
                                 I will use the "Modules" section replacement strategy if possible, 
                                 but the prompt asked to replace lines 122 down to end.
                                 I must include the Users and Request tabs logic in the replacement content 
                                 to avoid deleting them.
                             */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '1rem' }}>ID</th><th style={{ padding: '1rem' }}>Full Name</th><th style={{ padding: '1rem' }}>Email</th><th style={{ padding: '1rem' }}>Role</th><th style={{ padding: '1rem' }}>Status</th><th style={{ padding: '1rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(user => (
                                        <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem' }}>{user.id}</td>
                                            <td style={{ padding: '1rem' }}>{editingUser === user.id ? <input className="input-field" style={{ margin: 0 }} value={editForm.full_name || ''} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /> : user.full_name}</td>
                                            <td style={{ padding: '1rem' }}>{user.email}</td>
                                            <td style={{ padding: '1rem' }}>{editingUser === user.id ? <select className="input-field" style={{ margin: 0 }} value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}><option value="client">Client</option><option value="provider">Provider</option><option value="superuser">Superuser</option><option value="admin">Admin</option></select> : <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', background: user.role === 'admin' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)', color: user.role === 'admin' ? '#b91c1c' : '#1d4ed8', fontWeight: 'bold' }}>{user.role}</span>}</td>
                                            <td style={{ padding: '1rem' }}>{editingUser === user.id ? <select className="input-field" style={{ margin: 0 }} value={editForm.is_active ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}><option value="true">Active</option><option value="false">Disabled</option></select> : <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', background: user.is_active ? 'rgba(74, 222, 128, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: user.is_active ? '#15803d' : '#b91c1c', fontWeight: 'bold' }}>{user.is_active ? 'Active' : 'Disabled'}</span>}</td>
                                            <td style={{ padding: '1rem' }}>{editingUser === user.id ? <div style={{ display: 'flex', gap: '8px' }}><button onClick={handleSave} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>Save</button><button onClick={handleCancelEdit} style={{ background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>Cancel</button></div> : <div style={{ display: 'flex', gap: '8px' }}><button onClick={() => handleEditClick(user)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>Edit</button><button onClick={() => handleDelete(user.id)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>Delete</button></div>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'requests' && (
                    <div>
                        <form onSubmit={handleRequestSearch} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                            <input className="input-field" placeholder="Search by ID or Email..." value={requestSearch} onChange={e => setRequestSearch(e.target.value)} style={{ margin: 0, maxWidth: '400px' }} />
                            <button type="submit" className="btn-primary">Search</button>
                        </form>
                        <div className="glass-card" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '1rem' }}>ID</th><th style={{ padding: '1rem' }}>Email</th><th style={{ padding: '1rem' }}>Pickup</th><th style={{ padding: '1rem' }}>Delivery</th><th style={{ padding: '1rem' }}>Status</th><th style={{ padding: '1rem' }}>Amount</th><th style={{ padding: '1rem' }}>Date</th><th style={{ padding: '1rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.map(req => (
                                        <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem' }}>
                                                <span
                                                    style={{ color: 'var(--primary)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                                                    onClick={() => router.push(`/requests/${req.id}`)}
                                                >
                                                    {req.display_id || req.id}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>{req.user ? <div><div style={{ fontWeight: 'bold' }}>{req.user.email}</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{req.user.full_name}</div></div> : `User ${req.user_id}`}</td>
                                            <td style={{ padding: '1rem' }}>{req.pickup_address}</td>
                                            <td style={{ padding: '1rem' }}>{req.delivery_address}</td>
                                            <td style={{ padding: '1rem' }}><span className={`status-badge status-${req.status}`}>{req.status}</span></td>
                                            <td style={{ padding: '1rem' }}>€{req.estimated_price}</td>
                                            <td style={{ padding: '1rem' }}>{req.created_at ? new Date(req.created_at).toLocaleDateString() : '-'}</td>
                                            <td style={{ padding: '1rem' }}><div style={{ display: 'flex', gap: '8px' }}><button onClick={() => router.push(`/requests/${req.id}`)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>Details</button><button onClick={() => handleDeleteRequest(req.id)} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>Delete</button></div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- MODULES TAB --- */}
                {activeTab === 'modules' && (
                    <div>
                        {loadingModules && <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Working...</div>}

                        {/* 1. History Section */}
                        {/* Top Section: Updates & History */}
                        <div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                                {/* Left: Frontend */}
                                <div style={{ flex: '1 1 450px' }}>
                                    <ModuleList
                                        title="Outdated Frontend Modules"
                                        modules={outdatedFrontend.slice((pageOutdatedFrontend - 1) * OUTDATED_ITEMS_PER_PAGE, pageOutdatedFrontend * OUTDATED_ITEMS_PER_PAGE)}
                                        type="frontend"
                                        onUpdate={handleModuleUpdate}
                                        onDowngrade={handleDowngradeClick}
                                        hideSearch
                                        page={pageOutdatedFrontend}
                                        setPage={setPageOutdatedFrontend}
                                        hasNext={outdatedFrontend.length > pageOutdatedFrontend * OUTDATED_ITEMS_PER_PAGE}
                                        totalItems={outdatedFrontend.length}
                                        itemsPerPage={OUTDATED_ITEMS_PER_PAGE}
                                        updatingModule={updatingModule}
                                        emptyMessage="All frontend modules are up to date"
                                    />
                                </div>

                                {/* Right: Backend */}
                                <div style={{ flex: '1 1 450px' }}>
                                    <ModuleList
                                        title="Outdated Backend Modules"
                                        modules={outdatedBackend.slice((pageOutdatedBackend - 1) * OUTDATED_ITEMS_PER_PAGE, pageOutdatedBackend * OUTDATED_ITEMS_PER_PAGE)}
                                        type="backend"
                                        onUpdate={handleModuleUpdate}
                                        onDowngrade={handleDowngradeClick}
                                        hideSearch
                                        page={pageOutdatedBackend}
                                        setPage={setPageOutdatedBackend}
                                        hasNext={outdatedBackend.length > pageOutdatedBackend * OUTDATED_ITEMS_PER_PAGE}
                                        totalItems={outdatedBackend.length}
                                        itemsPerPage={OUTDATED_ITEMS_PER_PAGE}
                                        updatingModule={updatingModule}
                                        emptyMessage="All backend modules are up to date"
                                    />
                                </div>
                            </div>

                            {/* Right Column: History */}
                            <div style={{ margin: '3rem 0' }}>
                                <div className="glass-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                        <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Recent Update History</h2>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                            <button
                                                onClick={() => setPageHistory(Math.max(1, pageHistory - 1))}
                                                disabled={pageHistory === 1}
                                                style={{
                                                    padding: '4px 12px',
                                                    background: pageHistory === 1 ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                                                    color: pageHistory === 1 ? 'var(--text-muted)' : 'white',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '6px',
                                                    cursor: pageHistory === 1 ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                Prev
                                            </button>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Page {pageHistory} of {Math.ceil(historyTotal / ITEMS_PER_PAGE)}</span>
                                            <button
                                                onClick={() => setPageHistory(pageHistory + 1)}
                                                disabled={(pageHistory * ITEMS_PER_PAGE) >= historyTotal}
                                                style={{
                                                    padding: '4px 12px',
                                                    background: (pageHistory * ITEMS_PER_PAGE) >= historyTotal ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                                                    color: (pageHistory * ITEMS_PER_PAGE) >= historyTotal ? 'var(--text-muted)' : 'white',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '6px',
                                                    cursor: (pageHistory * ITEMS_PER_PAGE) >= historyTotal ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.85rem'
                                                }}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                        <thead style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                                            <tr>
                                                <th style={{ padding: '0.75rem' }}>Date</th>
                                                <th style={{ padding: '0.75rem' }}>User</th>
                                                <th style={{ padding: '0.75rem' }}>Module</th>
                                                <th style={{ padding: '0.75rem' }}>Action</th>
                                                <th style={{ padding: '0.75rem' }}>Version</th>
                                                <th style={{ padding: '0.75rem' }}>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {history.map(log => (
                                                <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <td style={{ padding: '0.75rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                                    <td style={{ padding: '0.75rem' }}>{log.user}</td>
                                                    <td style={{ padding: '0.75rem' }}>{log.module_type} / {log.module_name}</td>
                                                    <td style={{ padding: '0.75rem' }}>{log.action}</td>
                                                    <td style={{ padding: '0.75rem' }}>{log.from_version} &rarr; {log.to_version}</td>
                                                    <td style={{ padding: '0.75rem', color: log.status === 'success' ? '#4ade80' : '#ef4444' }}>{log.status}</td>
                                                </tr>
                                            ))}
                                            {history.length === 0 && <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No history found</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 3. All Modules with Search & Pagination */}
                        <div style={{ marginBottom: '1rem' }}>
                            <input
                                className="input-field"
                                placeholder="Search modules..."
                                value={moduleSearch}
                                onChange={e => setModuleSearch(e.target.value)}
                                style={{ maxWidth: '400px' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <ModuleList
                                title="Frontend Modules"
                                modules={paginatedFrontend}
                                type="frontend"
                                onUpdate={handleModuleUpdate}
                                onDowngrade={handleDowngradeClick}
                                page={pageFrontend}
                                setPage={setPageFrontend}
                                hasNext={filteredFrontend.length > pageFrontend * ITEMS_PER_PAGE}
                                totalItems={filteredFrontend.length}
                                itemsPerPage={ITEMS_PER_PAGE}
                            />
                            <ModuleList
                                title="Backend Modules"
                                modules={paginatedBackend}
                                type="backend"
                                onUpdate={handleModuleUpdate}
                                onDowngrade={handleDowngradeClick}
                                page={pageBackend}
                                setPage={setPageBackend}
                                hasNext={filteredBackend.length > pageBackend * ITEMS_PER_PAGE}
                                totalItems={filteredBackend.length}
                                itemsPerPage={ITEMS_PER_PAGE}
                            />
                        </div>
                    </div>
                )}

                {/* --- PRICE TABLE TAB --- */}
                {activeTab === 'prices' && (
                    <div className="glass-card">
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Standard Pricing Table</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '1rem' }}>Transport</th>
                                        <th style={{ padding: '1rem' }}>CBM</th>
                                        <th style={{ padding: '1rem' }}>Price/CBM</th>
                                        <th style={{ padding: '1rem' }}>Price/KM</th>
                                        <th style={{ padding: '1rem' }}>Platform Fee</th>
                                        <th style={{ padding: '1rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { transport: 'Small Van', cbm: '1-10' },
                                        { transport: 'Medium Van', cbm: '10-18' },
                                        { transport: 'Large Van', cbm: '18-22' },
                                        { transport: 'Medium Lorry', cbm: '25-40' },
                                        { transport: 'Large Lorry', cbm: '50+' },
                                        { transport: 'Sea Container 20fr', cbm: '1-33' },
                                        { transport: 'Sea Container 40fr', cbm: '33-67' },
                                        { transport: 'Sea Container 40fr high cube', cbm: '67-76' },
                                    ].map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem', fontWeight: '500' }}>{row.transport}</td>
                                            <td style={{ padding: '1rem' }}>{row.cbm}</td>
                                            <td style={{ padding: '1rem' }}>
                                                {/* Hardcoded empty for now */}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {/* Hardcoded empty for now */}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {/* Hardcoded Platform Fee */}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {editingPriceIdx === idx ? (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => setEditingPriceIdx(null)}
                                                            style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingPriceIdx(null)}
                                                            style={{ background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingPriceIdx(idx)}
                                                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Additional Service Pricing */}
                        <h2 style={{ marginBottom: '1.5rem', marginTop: '3rem', fontSize: '1.2rem' }}>Additional Service Pricing</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '1rem' }}>Service Name</th>
                                        <th style={{ padding: '1rem' }}>Quantity</th>
                                        <th style={{ padding: '1rem' }}>Price/Unit</th>
                                        <th style={{ padding: '1rem' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { name: 'Floor above 2nd', quantity: '5' },
                                    ].map((row, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '1rem' }}>{row.name}</td>
                                            <td style={{ padding: '1rem' }}>{row.quantity}</td>
                                            <td style={{ padding: '1rem' }}>{/* Empty */}</td>
                                            <td style={{ padding: '1rem' }}>
                                                {editingAdditionalIdx === idx ? (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => setEditingAdditionalIdx(null)}
                                                            style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingAdditionalIdx(null)}
                                                            style={{ background: '#64748b', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingAdditionalIdx(idx)}
                                                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- AI TRAINING TAB --- */}
                {activeTab === 'training' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 'bold' }}>AI Model Training</h2>
                            <button
                                onClick={fetchTrainingData}
                                style={{
                                    padding: '8px 16px',
                                    backgroundColor: '#cbd5e1',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                ↻ Refresh
                            </button>
                        </div>

                        {/* Stats Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <div style={{ color: '#64748b', fontSize: '14px' }}>Collected Images</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>
                                    {trainingStats?.images_count || 0}
                                </div>
                            </div>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <div style={{ color: '#64748b', fontSize: '14px' }}>Annotated Samples</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>
                                    {trainingStats?.labels_count || 0}
                                </div>
                            </div>
                            <div style={{ background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <div style={{ color: '#64748b', fontSize: '14px' }}>Classes Found</div>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '5px' }}>
                                    {trainingStats?.classes?.length || 0}
                                </div>
                                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>
                                    {trainingStats?.classes?.slice(0, 5).join(", ")}{trainingStats?.classes?.length > 5 ? "..." : ""}
                                </div>
                            </div>
                        </div>

                        {/* Action Area */}
                        <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '30px', textAlign: 'center' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Start Fine-Tuning</h3>
                            <p style={{ color: '#64748b', marginBottom: '20px', maxWidth: '600px', margin: '0 auto 20px auto' }}>
                                This process will aggregate all collected training data and fine-tune the YOLO model.
                                It may take several minutes depending on the dataset size.
                            </p>
                            <button
                                onClick={handleStartTraining}
                                disabled={isTrainingStarting}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: isTrainingStarting ? '#94a3b8' : '#3b82f6',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '500',
                                    cursor: isTrainingStarting ? 'not-allowed' : 'pointer',
                                    fontSize: '16px'
                                }}
                            >
                                {isTrainingStarting ? 'Starting...' : 'Start Training Now'}
                            </button>
                        </div>

                        {/* History Table */}
                        <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>Training History</h3>
                        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Date</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>User</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Status</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Duration (s)</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Epochs</th>
                                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trainingHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                                                No training history found.
                                            </td>
                                        </tr>
                                    ) : (
                                        trainingHistory.map((log) => (
                                            <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '12px 16px' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                                <td style={{ padding: '12px 16px' }}>{log.user?.email || 'Unknown'}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        padding: '2px 8px',
                                                        borderRadius: '999px',
                                                        fontSize: '12px',
                                                        fontWeight: '500',
                                                        background: log.status === 'success' ? '#dcfce7' : log.status === 'failed' ? '#fee2e2' : '#e0f2fe',
                                                        color: log.status === 'success' ? '#166534' : log.status === 'failed' ? '#991b1b' : '#075985'
                                                    }}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>{log.duration_seconds}s</td>
                                                <td style={{ padding: '12px 16px' }}>{log.epoch_count}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {log.log_output && (
                                                        <button
                                                            onClick={() => alert(log.log_output)}
                                                            style={{
                                                                background: 'none',
                                                                border: '1px solid #cbd5e1',
                                                                borderRadius: '4px',
                                                                padding: '4px 8px',
                                                                cursor: 'pointer',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            View Log
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {Math.ceil(trainingTotal / 10) > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
                                {Array.from({ length: Math.ceil(trainingTotal / 10) }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => fetchTrainingHistory(page)}
                                        style={{
                                            padding: '8px 12px',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: '6px',
                                            background: trainingPage === page ? '#3b82f6' : 'white',
                                            color: trainingPage === page ? 'white' : '#64748b',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Downgrade Modal */}
                {showDowngradeModal && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                    }}>
                        <div className="glass-card" style={{ padding: '2rem', width: '100%', maxWidth: '400px' }}>
                            <h3 style={{ marginBottom: '1rem' }}>Downgrade {selectedModule?.name}</h3>
                            {moduleVersions.length === 0 ? (
                                <p>Loading versions...</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                                    {moduleVersions.slice(0, 3).map(ver => (
                                        <button
                                            key={ver}
                                            onClick={() => handleDowngradeConfirm(selectedModule, ver)}
                                            style={{
                                                padding: '0.8rem',
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '8px',
                                                color: 'white',
                                                cursor: 'pointer',
                                                textAlign: 'left'
                                            }}
                                        >
                                            Downgrade to {ver}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button
                                onClick={() => setShowDowngradeModal(false)}
                                style={{ width: '100%', padding: '0.8rem', background: 'transparent', border: '1px solid var(--text-muted)', color: 'var(--text-muted)', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div >
    );
};

const ModuleList = ({ title, modules, type, onUpdate, onDowngrade, hideSearch, hidePagination, page, setPage, hasNext, updatingModule, emptyMessage, totalItems, itemsPerPage }) => (
    <div className="glass-card">
        <h2 style={{ marginBottom: '1rem', fontSize: '1.2rem' }}>{title}</h2>
        <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ color: 'var(--text-muted)', textAlign: 'left' }}>
                        <th style={{ padding: '0.75rem' }}>Name</th>
                        <th style={{ padding: '0.75rem' }}>Installed</th>
                        <th style={{ padding: '0.75rem' }}>Latest</th>
                        <th style={{ padding: '0.75rem' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {modules.map((mod, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.75rem' }}>{mod.name}</td>
                            <td style={{ padding: '0.75rem' }}>{mod.version}</td>
                            <td style={{ padding: '0.75rem', color: mod.version !== mod.latest ? '#facc15' : 'inherit' }}>
                                {mod.latest}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {mod.version !== mod.latest && (
                                        <button
                                            onClick={() => onUpdate(type, mod.name)}
                                            style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                        >
                                            Update
                                        </button>
                                    )}
                                    <button
                                        onClick={() => onDowngrade(type, mod.name)}
                                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                                    >
                                        Downgrade
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                    {modules.length === 0 && <tr><td colSpan={4} style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>{emptyMessage || 'No modules found'}</td></tr>}
                </tbody>
            </table>
        </div>
        {!hidePagination && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    style={{
                        padding: '6px 16px',
                        background: page === 1 ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                        color: page === 1 ? 'var(--text-muted)' : 'white',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        cursor: page === 1 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Prev
                </button>
                <span style={{ fontWeight: '600' }}>Page {page} of {Math.ceil((totalItems || 0) / (itemsPerPage || 10))}</span>
                <button
                    onClick={() => setPage(page + 1)}
                    disabled={!hasNext}
                    style={{
                        padding: '6px 16px',
                        background: !hasNext ? 'rgba(255,255,255,0.05)' : 'var(--primary)',
                        color: !hasNext ? 'var(--text-muted)' : 'white',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        cursor: !hasNext ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    Next
                </button>
            </div>
        )}
    </div>
);

export default AdminDashboard;
