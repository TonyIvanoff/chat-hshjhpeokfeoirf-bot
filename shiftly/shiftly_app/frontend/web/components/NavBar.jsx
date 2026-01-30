'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

const NavBar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = React.useState(null);

    React.useEffect(() => {
        const fetchUser = async () => {
            // Only fetch if token exists
            if (typeof window !== 'undefined' && localStorage.getItem('token')) {
                try {
                    const { getProfile } = await import('@/services/api');
                    const userData = await getProfile();
                    setUser(userData);
                } catch (err) {
                    console.error("Failed to fetch user", err);
                    // Optionally clear token if invalid
                }
            }
        };
        fetchUser();
    }, []);

    const handleLogout = () => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
        }
        router.push('/login');
    };

    return (
        <nav style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center',
            padding: '1rem 2rem',
            marginBottom: '2rem',
            background: 'var(--bg-main)', // Match main background
            borderBottom: '1px solid var(--glass-border)',
            borderRadius: '0 0 16px 16px'
        }}>
            {/* Logo */}
            <div
                style={{ cursor: 'pointer', justifySelf: 'start', display: 'flex', alignItems: 'center' }}
                onClick={() => router.push('/dashboard')}
            >
                <img src="/shiftly_logo_final.png" alt="Shiftly" style={{ height: '50px', width: 'auto' }} />
            </div>

            {/* Center: Navigation */}
            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', width: '100%' }}>
                <span
                    style={{
                        cursor: 'pointer',
                        color: pathname === '/dashboard' ? 'var(--primary)' : 'var(--text-main)',
                        color: pathname === '/dashboard' ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: pathname === '/dashboard' ? 'bold' : 'normal',
                        fontSize: '1.2rem'
                    }}
                    onClick={() => router.push('/dashboard')}
                >
                    Dashboard
                </span>

                {user && user.role === 'admin' && (
                    <span
                        style={{
                            cursor: 'pointer',
                            color: pathname === '/admin' ? 'var(--primary)' : 'var(--text-main)',
                            color: pathname === '/admin' ? 'var(--primary)' : 'var(--text-main)',
                            fontWeight: pathname === '/admin' ? 'bold' : 'normal',
                            fontSize: '1.2rem'
                        }}
                        onClick={() => router.push('/admin')}
                    >
                        Admin
                    </span>
                )}

                <span
                    style={{
                        cursor: 'pointer',
                        color: pathname.startsWith('/profile') ? 'var(--primary)' : 'var(--text-main)',
                        color: pathname.startsWith('/profile') ? 'var(--primary)' : 'var(--text-main)',
                        fontWeight: pathname.startsWith('/profile') ? 'bold' : 'normal',
                        fontSize: '1.2rem'
                    }}
                    onClick={() => router.push('/profile')}
                >
                    Profile
                </span>
            </div>

            {/* Right: User & Logout */}
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', justifySelf: 'end' }}>
                {user && (
                    <span style={{
                        color: 'var(--primary)',
                        fontWeight: '600',
                        fontSize: '1.2rem',
                        marginRight: '0.5rem'
                    }}>
                        Hi, {user.full_name || user.email}
                    </span>
                )}

                <button
                    onClick={handleLogout}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '10px',
                        fontSize: '1.1rem',
                        background: 'transparent',
                        border: '1px solid #ef4444',
                        color: '#ef4444',
                        cursor: 'pointer'
                    }}
                >
                    Logout
                </button>
            </div>
        </nav>
    );
};

export default NavBar;
