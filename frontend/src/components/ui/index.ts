// ── Core UI components — Phase 2 design system ──────────────────────────
export { default as Button, buttonVariants }       from './Button';
export type { ButtonProps }                        from './Button';
export { default as Card, CardHeader, CardTitle, CardContent, CardFooter, cardVariants } from './Card';
export type { CardProps }                          from './Card';
export { default as Badge, badgeVariants }         from './Badge';
export type { BadgeProps }                         from './Badge';
export { default as Input }                        from './Input';
export type { InputProps }                         from './Input';
export { default as Modal }                        from './Modal';
export { default as Tooltip, TooltipProvider }     from './Tooltip';
export { default as EmptyState }                   from './EmptyState';
export { Skeleton, JobCardSkeleton, StatRowSkeleton, SkillPanelSkeleton, KanbanCardSkeleton } from './Skeleton';
export { default as Avatar }                       from './Avatar';

// ── Existing components (preserved) ─────────────────────────────────────
export { default as MatchCircle }                  from './MatchCircle';
export { default as TagInput }                     from './TagInput';
export { default as AuthLayout }                   from './AuthLayout';
export { default as JobCard }                      from './JobCard';
