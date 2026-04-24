import React, { useState } from 'react';
import { X, Camera, MousePointerClick, CheckCircle, Trash2, RefreshCw } from 'lucide-react';
import dynamicImportHtml2canvas from './html2canvasLoader';
import styles from './ReportBugModalRedesign.module.css';

interface Props {
  onClose: () => void;
}

const ReportBugModalRedesign: React.FC<Props> = ({ onClose }) => {
  const [description, setDescription] = useState('');
  const [step, setStep] = useState<'desc' | 'point' | 'done'>('desc');
  const [minimized, setMinimized] = useState(false);
  const [elementSelector, setElementSelector] = useState('');
  const [elementHighlight, setElementHighlight] = useState<HTMLElement | null>(null);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [screenshotError, setScreenshotError] = useState('');

  // Improved element picker with highlight
  const handlePickElement = () => {
    setMinimized(true);
    setStep('point');
    setTimeout(() => {
      document.body.style.cursor = 'crosshair';
      let lastEl: HTMLElement | null = null;
      const mouseOverHandler = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (!el) return;
        if (lastEl && lastEl !== el) {
          lastEl.style.outline = '';
        }
        el.style.outline = '2px solid #f43f5e';
        setElementHighlight(el);
        lastEl = el;
      };
      const mouseOutHandler = (e: MouseEvent) => {
        const el = e.target as HTMLElement;
        if (el && el.style) el.style.outline = '';
      };
      const clickHandler = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const el = e.target as HTMLElement;
        if (!el) return;
        setElementSelector(getDomSelector(el));
        el.style.outline = '';
        setElementHighlight(null);
        setStep('desc');
        setMinimized(false);
        document.body.style.cursor = '';
        window.removeEventListener('mouseover', mouseOverHandler, true);
        window.removeEventListener('mouseout', mouseOutHandler, true);
        window.removeEventListener('click', clickHandler, true);
      };
      window.addEventListener('mouseover', mouseOverHandler, true);
      window.addEventListener('mouseout', mouseOutHandler, true);
      window.addEventListener('click', clickHandler, true);
    }, 200); // allow modal to hide first
  };

  // Simple selector generator
  function getDomSelector(el: HTMLElement): string {
    if (!el) return '';
    let path = '';
    while (el && el.nodeType === 1 && el.tagName.toLowerCase() !== 'body') {
      let selector = el.tagName.toLowerCase();
      if (el.id) selector += `#${el.id}`;
      else if (el.className) selector += `.${el.className.split(' ').join('.')}`;
      path = selector + (path ? ' > ' + path : '');
      el = el.parentElement!;
    }
    return path;
  }

  // Real screenshot using html2canvas
  const handleScreenshot = async () => {
    setScreenshotError('');
    try {
      const html2canvas = await dynamicImportHtml2canvas;
      const target = elementSelector
        ? document.querySelector(elementSelector.split(' > ').join(' ')) as HTMLElement
        : document.body;
      if (!target) throw new Error('Could not find element to screenshot');
      // Scroll target into view for accurate screenshot
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      await new Promise(res => setTimeout(res, 350)); // Wait for scroll
      const canvas = await html2canvas(target, { backgroundColor: null, useCORS: true, scale: 2 });
      setScreenshotUrl(canvas.toDataURL('image/png'));
    } catch (e: any) {
      setScreenshotError('Screenshot failed. Try again or select a different area.');
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    // TODO: Save to Firestore or backend
    setTimeout(() => {
      setStep('done');
      setSubmitting(false);
    }, 1200);
  };

  if (minimized) return null;

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modalCard}>
        <button onClick={onClose} className={styles.closeBtn}><X size={20}/></button>
        <div className={styles.header}>🐞 Report a Problem</div>
        <div className={styles.desc}>Found a bug or issue? Help us improve by reporting it here. You can point to the place on the screen and attach a screenshot.</div>
        {step === 'desc' && (
          <>
            <textarea
              className={styles.textarea}
              rows={3}
              placeholder="Describe the problem..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={submitting}
            />
            <div className={styles.actions}>
              <button onClick={handlePickElement} className={styles.actionBtn}><MousePointerClick size={18}/> Point Location</button>
              <button onClick={handleScreenshot} className={styles.actionBtn}><Camera size={18}/> Screenshot</button>
            </div>
            {elementSelector && <div className={styles.locationInfo}>Location: <span style={{fontFamily:'monospace'}}>{elementSelector}</span> <button className={styles.locationClear} title="Clear" onClick={() => setElementSelector('')}><Trash2 size={14}/></button></div>}
            {screenshotError && <div className={styles.screenshotError}>{screenshotError}</div>}
            {screenshotUrl && (
              <div className={styles.screenshotPreview}>
                <img src={screenshotUrl} alt="Screenshot" className={styles.screenshotImg} />
                <button className={styles.screenshotRemove} title="Retake" onClick={() => setScreenshotUrl('')}><RefreshCw size={14}/></button>
              </div>
            )}
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={!description || submitting}
            >{submitting ? 'Submitting...' : 'Submit Report'}</button>
          </>
        )}
        {step === 'point' && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2.5rem 0'}}>
            <MousePointerClick size={44} style={{color:'#f43f5e',marginBottom:18}}/>
            <div style={{color:'#be123c',fontWeight:900,fontSize:'1.2rem',marginBottom:6}}>Click anywhere on the page</div>
            <div style={{color:'#64748b',fontSize:'1rem'}}>to mark the problem location</div>
          </div>
        )}
        {step === 'done' && (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'2.5rem 0'}}>
            <CheckCircle size={44} style={{color:'#10b981',marginBottom:18}}/>
            <div style={{color:'#059669',fontWeight:900,fontSize:'1.2rem',marginBottom:6}}>Thank you!</div>
            <div style={{color:'#64748b',fontSize:'1rem'}}>Your report has been submitted.</div>
            <button onClick={onClose} style={{marginTop:24,padding:'0.7rem 2.5rem',borderRadius:12,background:'#10b981',color:'#fff',fontWeight:900,fontSize:'1.1rem',border:'none'}}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportBugModalRedesign;
