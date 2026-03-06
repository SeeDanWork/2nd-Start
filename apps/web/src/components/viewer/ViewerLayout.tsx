import { useEffect, useState, createContext, useContext, CSSProperties } from 'react';
import { Outlet, useParams, NavLink } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ViewerContextValue {
  familyId: string;
  token: string;
}

const ViewerContext = createContext<ViewerContextValue>({ familyId: '', token: '' });

export function useViewer() {
  return useContext(ViewerContext);
}

export function ViewerLayout() {
  const { familyId, token } = useParams<{ familyId: string; token: string }>();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid'>('loading');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    fetch(`${API_BASE}/viewer/validate/${token}`)
      .then((res) => res.json())
      .then((resp) => {
        // Handle both raw { valid } and NestJS wrapped { data: { valid } }
        const payload = resp.data ?? resp;
        setStatus(payload.valid ? 'valid' : 'invalid');
      })
      .catch(() => {
        setStatus('invalid');
      });
  }, [token]);

  if (status === 'loading') {
    return (
      <div style={styles.center}>
        <p style={styles.loadingText}>Validating access...</p>
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div style={styles.center}>
        <p style={styles.invalidTitle}>Link Expired or Invalid</p>
        <p style={styles.invalidText}>
          This link has expired or is invalid. Request a new one by texting
          &quot;show schedule&quot;.
        </p>
      </div>
    );
  }

  const basePath = `/view/${familyId}/${token}`;

  return (
    <ViewerContext.Provider value={{ familyId: familyId!, token: token! }}>
      <div style={styles.root}>
        <nav style={styles.nav}>
          <span style={styles.brand}>ADCP</span>
          <NavLink
            to={basePath}
            end
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            Schedule
          </NavLink>
          <NavLink
            to={`${basePath}/metrics`}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            Metrics
          </NavLink>
          <NavLink
            to={`${basePath}/history`}
            style={({ isActive }) => ({
              ...styles.navLink,
              ...(isActive ? styles.navLinkActive : {}),
            })}
          >
            History
          </NavLink>
        </nav>
        <div style={styles.content}>
          <Outlet />
        </div>
      </div>
    </ViewerContext.Provider>
  );
}

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    gap: 8,
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  invalidTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#ef4444',
    margin: 0,
  },
  invalidText: {
    fontSize: 14,
    color: '#6b7280',
    maxWidth: 400,
    textAlign: 'center',
    margin: 0,
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '8px 16px',
    borderBottom: '1px solid #e5e7eb',
    backgroundColor: '#f8f9fa',
  },
  brand: {
    fontWeight: 700,
    fontSize: 15,
    color: '#4A90D9',
    marginRight: 16,
  },
  navLink: {
    padding: '6px 14px',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: '#374151',
    textDecoration: 'none',
  },
  navLinkActive: {
    backgroundColor: '#4A90D9',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: 16,
  },
};
