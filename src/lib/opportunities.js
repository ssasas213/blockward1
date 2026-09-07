// Frontend display helpers for the opportunities marketplace.

export const OPPORTUNITY_TYPES = [
  { value: 'internship', label: 'Internship' },
  { value: 'competition', label: 'Competition' },
  { value: 'volunteering', label: 'Volunteering' },
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'trial', label: 'Trial' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'part_time_role', label: 'Part-time role' },
];

export const OPPORTUNITY_TYPE_LABELS = Object.fromEntries(
  OPPORTUNITY_TYPES.map((t) => [t.value, t.label])
);

export const APP_STATUS_LABELS = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interviewing: 'Interviewing',
  offered: 'Offered',
  rejected: 'Rejected',
};

export const APP_STATUS_VARIANTS = {
  applied: 'secondary',
  shortlisted: 'info',
  interviewing: 'info',
  offered: 'success',
  rejected: 'destructive',
};

export const OPP_STATUS_LABELS = { draft: 'Draft', open: 'Open', closed: 'Closed' };
export const OPP_STATUS_VARIANTS = { draft: 'secondary', open: 'success', closed: 'destructive' };

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(23, 59, 59, 999);
  return Math.ceil((d - new Date()) / 86400000);
}

export function formatDeadline(dateStr) {
  if (!dateStr) return 'Rolling';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}