import React from 'react';
import { DeletionStatus } from '../types';

interface StatusBadgeProps {
  status: DeletionStatus | 'connected' | 'not_connected' | 'experimental' | 'verified';
  text?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, text }) => {
  let badgeStyles = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  let defaultLabel = text || status;

  switch (status) {
    case 'connected':
    case 'deleted':
    case 'verified':
      badgeStyles = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50';
      defaultLabel = text || (status === 'connected' ? 'Connected' : status === 'verified' ? 'Verified' : 'Deleted');
      break;
    case 'failed':
      badgeStyles = 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50';
      defaultLabel = text || 'Failed';
      break;
    case 'in_progress':
      badgeStyles = 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 animate-pulse border border-amber-200 dark:border-amber-800/50';
      defaultLabel = text || 'In Progress';
      break;
    case 'skipped':
    case 'experimental':
      badgeStyles = 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border border-orange-200 dark:border-orange-800/50';
      defaultLabel = text || (status === 'experimental' ? 'Experimental' : 'Skipped');
      break;
    case 'unverified':
      badgeStyles = 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50';
      defaultLabel = text || 'Unverified';
      break;
    case 'not_connected':
      badgeStyles = 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400';
      defaultLabel = text || 'Not Connected';
      break;
    default:
      break;
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tracking-wide ${badgeStyles}`}>
      {defaultLabel}
    </span>
  );
};
