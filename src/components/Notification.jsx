import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, XCircle, Info, X } from 'lucide-react';

const Notification = ({ message, type = 'info', onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    const styles = {
        container: {
            position: 'fixed',
            top: '20px',
            right: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 9999,
            animation: 'slideIn 0.3s ease-out',
            minWidth: '300px',
            maxWidth: '400px',
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
        },
        success: { borderLeft: '5px solid #10b981' },
        error: { borderLeft: '5px solid #ef4444' },
        warning: { borderLeft: '5px solid #f59e0b' },
        info: { borderLeft: '5px solid #3b82f6' },
        text: {
            flex: 1,
            color: '#1e293b',
            fontSize: '0.95rem',
            fontWeight: 500
        },
        close: {
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#94a3b8'
        }
    };

    let Icon = Info;
    let color = '#3b82f6';
    let typeStyle = styles.info;

    switch (type) {
        case 'success':
            Icon = CheckCircle;
            color = '#10b981';
            typeStyle = styles.success;
            break;
        case 'error':
            Icon = AlertCircle;
            color = '#ef4444';
            typeStyle = styles.error;
            break;
        case 'warning':
            Icon = AlertCircle;
            color = '#f59e0b';
            typeStyle = styles.warning;
            break;
        default:
            break;
    }

    return (
        <div style={{ ...styles.container, ...typeStyle }}>
            <style>
                {`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                `}
            </style>
            <Icon size={24} color={color} />
            <span style={styles.text}>{message}</span>
            <button onClick={onClose} style={styles.close}>
                <X size={18} />
            </button>
        </div>
    );
};

export default Notification;
