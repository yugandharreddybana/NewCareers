import React from 'react';
import { Link } from 'react-router-dom';

const NotFound: React.FC = () => (
  <div className="not-found-page" style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '70vh',
    gap: '1.5rem',
    textAlign: 'center',
    padding: '2rem',
  }}>
    <div style={{ fontSize: '6rem', lineHeight: 1 }}>🗺️</div>
    <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0 }}>Page not found</h1>
    <p style={{ color: 'var(--color-text-muted)', maxWidth: '36ch', margin: 0 }}>
      The page you're looking for doesn't exist or has been moved.
    </p>
    <Link
      to="/"
      style={{
        display: 'inline-block',
        padding: '0.6rem 1.5rem',
        background: 'var(--color-primary)',
        color: '#fff',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        fontWeight: 600,
      }}
    >
      Go back home
    </Link>
  </div>
);

export default NotFound;
