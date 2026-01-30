'use client';
import React, { useState, useEffect } from 'react';
import { getProfile, updateProfile, changePassword } from '@/services/api';
import NavBar from '@/components/NavBar';

const Profile = () => {
    const [user, setUser] = useState(null);
    const [fullName, setFullName] = useState('');
    const [passwords, setPasswords] = useState({ current: '', new: '' });
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const data = await getProfile();
            setUser(data);
            setFullName(data.full_name || '');
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateName = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        try {
            await updateProfile({ full_name: fullName });
            setMsg({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to update profile' });
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });
        try {
            await changePassword({
                current_password: passwords.current,
                new_password: passwords.new
            });
            setMsg({ type: 'success', text: 'Password changed successfully!' });
            setPasswords({ current: '', new: '' });
        } catch (err) {
            const errorText = err.response?.data?.detail || 'Failed to change password';
            setMsg({ type: 'error', text: errorText });
        }
    };

    if (loading) return <div style={{ padding: '2rem', color: 'white' }}>Loading...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '2rem' }}>
            <NavBar />

            <div style={{ padding: '0 2rem' }}>
                <h1 style={{ marginBottom: '2rem' }}>My Profile</h1>

                {msg.text && (
                    <div style={{
                        padding: '1rem', marginBottom: '1.5rem', borderRadius: '8px',
                        background: msg.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(74, 222, 128, 0.1)',
                        color: msg.type === 'error' ? '#ef4444' : '#4ade80',
                        border: `1px solid ${msg.type === 'error' ? '#ef4444' : '#4ade80'}`
                    }}>
                        {msg.text}
                    </div>
                )}

                <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Personal Info</h2>
                    <form onSubmit={handleUpdateName}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ color: 'var(--text-muted)' }}>Email (Read-only)</label>
                            <input className="input-field" value={user?.email || ''} disabled style={{ opacity: 0.7 }} />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label>Full Name</label>
                            <input
                                className="input-field"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                placeholder="Your Name"
                            />
                        </div>
                        <button className="btn-primary" type="submit">Save Info</button>
                    </form>
                </div>

                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Security</h2>
                    <form onSubmit={handleChangePassword}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label>Current Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={passwords.current}
                                onChange={e => setPasswords({ ...passwords, current: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label>New Password</label>
                            <input
                                type="password"
                                className="input-field"
                                value={passwords.new}
                                onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                required
                            />
                        </div>
                        <button className="btn-primary" type="submit">Change Password</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Profile;
