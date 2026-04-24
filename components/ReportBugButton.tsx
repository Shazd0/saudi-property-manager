import React, { useState } from 'react';
import { MessageCircleWarning } from 'lucide-react';
import ReportBugModalRedesign from './ReportBugModalRedesign';

const ReportBugButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow-lg p-4 flex items-center gap-2 font-bold text-base transition-all animate-bounce"
        style={{ boxShadow: '0 4px 24px 0 #f43f5e55' }}
        title="Report a Problem"
      >
        <MessageCircleWarning size={22} className="mr-1" />
        Report a Problem
      </button>
      {open && <ReportBugModalRedesign onClose={() => setOpen(false)} />}
    </>
  );
};

export default ReportBugButton;
