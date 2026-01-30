'use client';
import { useRouter } from 'next/navigation';

export default function AccessRestricted() {
    const router = useRouter();

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            textAlign: 'center'
        }}>
            <div className="glass-card" style={{ padding: '3rem', maxWidth: '500px' }}>
                <h1 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '3rem' }}>🚫</h1>
                <h2 style={{ marginBottom: '1rem' }}>Access Restricted</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                    You do not have permission to view this page.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                        className="btn-primary"
                        onClick={() => router.push('/dashboard')}
                    >
                        Go to Dashboard
                    </button>
                    <button
                        style={{
                            padding: '12px 24px',
                            background: 'transparent',
                            border: '1px solid var(--primary)',
                            color: 'var(--primary)',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease'
                        }}
                        onClick={() => router.push('/login')}
                    >
                        Login
                    </button>
                </div>
            </div>
        </div>
    );
}
