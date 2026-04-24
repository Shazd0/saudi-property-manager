import React, { useState } from 'react';
import { X, Camera, MousePointerClick, CheckCircle, Trash2, RefreshCw } from 'lucide-react';
import dynamicImportHtml2canvas from './html2canvasLoader';

interface Props {
  onClose: () => void;
}

const ReportBugModal: React.FC<Props> = ({ onClose }) => {
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
      const canvas = await html2canvas(target, { backgroundColor: null, useCORS: true });
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

  if (minimized) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-fade-in">
        <button onClick={onClose} className="absolute top-3 right-3 p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={18}/></button>
        <h2 className="text-xl font-black text-rose-700 mb-2">Report a Problem</h2>
        <p className="text-slate-500 mb-4 text-sm">Found a bug or issue? Help us improve by reporting it here. Optionally, point to the place on the screen and attach a screenshot.</p>
        {step === 'desc' && (
          <>
            <textarea
              className="w-full border border-rose-200 rounded-xl p-3 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-rose-400"
              rows={3}
              placeholder="Describe the problem..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={submitting}
            />
            <div className="flex gap-2 mb-3">
              <button onClick={handlePickElement} className="flex-1 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-bold flex items-center justify-center gap-2 hover:bg-rose-100"><MousePointerClick size={16}/> Point Location</button>
              <button onClick={handleScreenshot} className="flex-1 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold flex items-center justify-center gap-2 hover:bg-slate-100"><Camera size={16}/> Screenshot</button>
            </div>
            {elementSelector && <div className="mb-2 text-xs text-rose-600">Location: <span className="font-mono">{elementSelector}</span> <button className="ml-2 text-rose-400 hover:text-rose-600" title="Clear" onClick={() => setElementSelector('')}><Trash2 size={14}/></button></div>}
            {screenshotError && <div className="text-xs text-rose-600 mb-2">{screenshotError}</div>}
            {screenshotUrl && (
              <div className="mb-2 relative">
                <img src={screenshotUrl} alt="Screenshot" className="rounded-lg border border-slate-200 mb-1" style={{maxWidth: '100%'}} />
                <button className="absolute top-1 right-1 bg-white/80 rounded-full p-1 hover:bg-rose-100" title="Retake" onClick={() => setScreenshotUrl('')}><RefreshCw size={14}/></button>
              </div>
            )}
            <button
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-base mt-2 disabled:opacity-50"
              onClick={handleSubmit}
              disabled={!description || submitting}
            >{submitting ? 'Submitting...' : 'Submit Report'}</button>
          </>
        )}
        {step === 'point' && (
          <div className="flex flex-col items-center justify-center py-8">
            <MousePointerClick size={40} className="text-rose-400 mb-4 animate-bounce"/>
            <div className="text-rose-700 font-bold text-lg mb-2">Click anywhere on the page</div>
            <div className="text-slate-500 text-sm">to mark the problem location</div>
          </div>
        )}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle size={40} className="text-emerald-500 mb-4"/>
            <div className="text-emerald-700 font-bold text-lg mb-2">Thank you!</div>
            <div className="text-slate-500 text-sm">Your report has been submitted.</div>
            <button onClick={onClose} className="mt-6 px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold">Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportBugModal;
