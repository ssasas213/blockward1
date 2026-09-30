// Shared organisation status labels for the internal admin UI.
export const STATUS_META = {
  pending: { label: 'Pending review', cls: 'bg-warning/10 text-warning border-warning/30' },
  verified: { label: 'Verified', cls: 'bg-success/10 text-success border-success/30' },
  rejected: { label: 'Rejected', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  suspended: { label: 'Suspended', cls: 'bg-secondary text-muted-foreground border-border' },
};

export const TYPE_LABELS = {
  company: 'Company', university: 'University', school: 'School',
  certification_provider: 'Certification provider', training_provider: 'Training provider',
  competition: 'Competition', sports_organisation: 'Sports organisation',
  nonprofit: 'Nonprofit', professional_organisation: 'Professional organisation', other: 'Other',
};