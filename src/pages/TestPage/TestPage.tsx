/**
 * Data Cleanup Utility Page
 * 
 * Navigate to /test to access data cleanup utilities
 * Requires authentication to run cleanup operations
 */

import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { runCleanup } from '../../scripts/cleanupTestData';
import { assignAdminRoleToExistingUser } from '../../services/adminAccounts';
import { useNavigate } from 'react-router-dom';

export default function TestPage() {
  const { user, participant, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isRunning, setIsRunning] = useState(false);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);

  if (authLoading) {
    return (
      <div style={{
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#127bbe', marginBottom: '1rem' }}>Data Cleanup Utility</h1>
        <p>Loading authentication status...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <h1 style={{ color: '#127bbe', marginBottom: '1rem' }}>Data Cleanup Utility</h1>
        <div style={{
          padding: '2rem',
          backgroundColor: '#fff3e0',
          borderRadius: '8px',
          border: '2px solid #ff9800',
          marginBottom: '2rem'
        }}>
          <h2 style={{ marginTop: 0, color: '#e65100' }}>⚠️ Authentication Required</h2>
          <p style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
            You must be logged in to run cleanup operations. Firebase authentication is required.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#127bbe',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ color: '#127bbe', marginBottom: '1rem' }}>Data Cleanup Utility</h1>
      
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#e8f5e9',
        borderRadius: '8px',
        marginBottom: '1rem',
        border: '1px solid #4caf50'
      }}>
        <p style={{ margin: 0, color: '#2e7d32' }}>
          ✅ <strong>Authenticated as:</strong> {user.email || user.uid}
        </p>
        {participant && (participant as { role?: string })?.role && (
          <p style={{ margin: '0.5rem 0 0 0', color: '#2e7d32', fontSize: '0.9rem' }}>
            <strong>Current Role:</strong> {(participant as { role?: string }).role}
          </p>
        )}
      </div>

      {adminStatus && (
        <div style={{
          padding: '1rem',
          backgroundColor: adminStatus.includes('✅') ? '#e8f5e9' : '#ffebee',
          borderRadius: '8px',
          marginBottom: '1rem',
          border: `1px solid ${adminStatus.includes('✅') ? '#4caf50' : '#f44336'}`
        }}>
          <p style={{ margin: 0, color: adminStatus.includes('✅') ? '#2e7d32' : '#c62828' }}>
            {adminStatus}
          </p>
        </div>
      )}

      {isRunning && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          marginBottom: '1rem'
        }}>
          <p>⏳ Running cleanup... Check the browser console for detailed output.</p>
        </div>
      )}

      <div style={{
        padding: '1rem',
        backgroundColor: '#e3f2fd',
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2 style={{ marginTop: 0 }}>Utilities</h2>
        <p>Use the buttons below to clean up test data.</p>
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={async () => {
            if (confirm('This will clean up test data (weeks 97-99, test logs). Continue?')) {
              setIsRunning(true);
              try {
                console.log('Starting cleanup...');
                await runCleanup();
                alert('Cleanup complete! Check console for details.');
              } catch (error) {
                console.error('Error during cleanup:', error);
                alert('Error during cleanup. Check console for details.');
              } finally {
                setIsRunning(false);
              }
            }
          }}
          disabled={isRunning}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#ff9800',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            opacity: isRunning ? 0.6 : 1
          }}
        >
          🧹 Cleanup Test Data
        </button>

        <button
          onClick={async () => {
            if (!user) {
              setAdminStatus('❌ Error: User not authenticated');
              return;
            }

            if (confirm('This will set your role to Admin. You will be able to access the admin dashboard. Continue?')) {
              setIsRunning(true);
              setAdminStatus(null);
              try {
                const participantData = participant as { firstName?: string; lastName?: string } | null;
                await assignAdminRoleToExistingUser({
                  participantId: user.uid,
                  firstName: participantData?.firstName,
                  lastName: participantData?.lastName,
                  role: 'Admin',
                });
                setAdminStatus('✅ Success! Your role has been set to Admin. Please refresh the page to see changes.');
                console.log('Admin role assigned successfully!');
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              } catch (error) {
                console.error('Error assigning admin role:', error);
                setAdminStatus('❌ Error: Failed to assign admin role. Check console for details.');
              } finally {
                setIsRunning(false);
              }
            }
          }}
          disabled={isRunning}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#9c27b0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            opacity: isRunning ? 0.6 : 1
          }}
        >
          👑 Make Me Admin
        </button>
      </div>
    </div>
  );
}

