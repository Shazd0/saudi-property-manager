import React from 'react';
import logo from '../images/logo.png';
import { useLanguage } from '../i18n';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  /** Use inline mode for form-level overlay (absolute positioned within parent) */
  inline?: boolean;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ visible, message, inline = false }) => {
  const { t, isRTL } = useLanguage();
  if (!visible) return null;

  return (
    <div className={inline ? 'loading-overlay-inline' : 'loading-overlay'}>
      <div className="loading-overlay-content">
        <img
          src={logo}
          alt="Amlak"
          className={`loading-logo animate-spin-logo ${!inline ? 'loading-logo-lg' : ''}`}
          onError={(e) => { (e.target as HTMLImageElement).src = '/images/logo.png'; }}
        />
        {message && <p className="loading-message">{message}</p>}
        {!message && !inline && <p className="loading-message">جاري المعالجة...</p>}
      </div>
    </div>
  );
};

export default LoadingOverlay;
