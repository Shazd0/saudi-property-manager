import React from 'react';

interface ArchetypeCardProps {
  title: string;
  identityStatement: string;
  description: string;
  percentage: number;
  year: number;
}

const ArchetypeCard: React.FC<ArchetypeCardProps> = ({ title, identityStatement, description, percentage, year }) => (
  <div className="max-w-md mx-auto p-8 rounded-2xl bg-white shadow-lg border border-slate-200 text-center">
    <h2 className="text-2xl font-black text-emerald-800 mb-2">{title}</h2>
    <p className="text-emerald-600 font-medium mb-4">{identityStatement}</p>
    <p className="text-slate-500 text-sm mb-4">{description}</p>
    <div className="text-3xl font-black text-emerald-500">{percentage}%</div>
    <div className="text-xs text-slate-400 mt-1">{year}</div>
  </div>
);

export default ArchetypeCard;
