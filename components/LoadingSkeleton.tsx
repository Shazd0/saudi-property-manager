import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`skeleton rounded ${className}`} aria-hidden="true" />
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3 ${className}`}>
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-8 w-32" />
    <Skeleton className="h-3 w-20" />
  </div>
);

export const SkeletonTableRows: React.FC<{ count?: number; columns?: number }> = ({
  count = 8,
  columns = 5,
}) => (
  <div className="space-y-2" aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }).map((_, row) => (
      <div key={row} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
        {Array.from({ length: columns }).map((__, col) => (
          <Skeleton
            key={col}
            className={`h-4 ${col === 0 ? 'w-28' : col === columns - 1 ? 'w-16 ml-auto' : 'flex-1'}`}
          />
        ))}
      </div>
    ))}
  </div>
);

export const SkeletonDashboard: React.FC = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-4">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-56 w-full rounded-xl" />
      </div>
    </div>
    <SkeletonTableRows count={5} columns={4} />
  </div>
);

export const SkeletonBuildingCards: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    ))}
  </div>
);

export const SkeletonCustomerGrid: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-8 w-full rounded-lg" />
      </div>
    ))}
  </div>
);

export default Skeleton;
