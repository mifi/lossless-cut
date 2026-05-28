import type { ButtonHTMLAttributes, CSSProperties, DetailedHTMLProps, HTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import styles from './PlayerChrome.module.css';

type ButtonProps = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>;

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function PlayerSurfaceGroup({
  className,
  compact = false,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { compact?: boolean }) {
  return (
    <div
      className={joinClasses(styles['surfaceGroup'], compact && styles['surfaceGroupCompact'], className)}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    >
      {children}
    </div>
  );
}

export const PlayerIconButton = forwardRef<HTMLButtonElement, ButtonProps & {
  active?: boolean,
  quiet?: boolean,
  muted?: boolean,
  danger?: boolean,
  large?: boolean,
}>(({
  type = 'button',
  className,
  active,
  quiet,
  muted,
  danger,
  large,
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    type={type}
    data-active={active || undefined}
    data-quiet={quiet || undefined}
    data-muted={muted || undefined}
    data-danger={danger || undefined}
    className={joinClasses(styles['iconButton'], large && styles['iconButtonLarge'], className)}
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...props}
  >
    {children}
  </button>
));
PlayerIconButton.displayName = 'PlayerIconButton';

export const PlayerTransportButton = forwardRef<HTMLButtonElement, ButtonProps>(({
  type = 'button',
  className,
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    type={type}
    className={joinClasses(styles['transportButton'], className)}
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...props}
  >
    {children}
  </button>
));
PlayerTransportButton.displayName = 'PlayerTransportButton';

export const PlayerSegmentBadgeButton = forwardRef<HTMLButtonElement, ButtonProps & {
  accentColor?: string,
  empty?: boolean,
}>(({
  type = 'button',
  className,
  accentColor,
  empty,
  style,
  children,
  ...props
}, ref) => (
  <button
    ref={ref}
    type={type}
    data-empty={empty || undefined}
    className={joinClasses(styles['segmentBadge'], className)}
    style={{ '--player-segment-accent-border': accentColor, '--player-segment-accent-soft': accentColor != null ? `${accentColor}33` : undefined, ...style } as CSSProperties}
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...props}
  >
    {children}
  </button>
));
PlayerSegmentBadgeButton.displayName = 'PlayerSegmentBadgeButton';

export function PlayerSegmentBadgeText({ text, empty = false }: { text: string, empty?: boolean }) {
  return (
    <span className={joinClasses(styles['segmentBadgeNumber'], empty && styles['segmentBadgeEmpty'])}>
      {text}
    </span>
  );
}

export const PlayerPillButton = forwardRef<HTMLButtonElement, ButtonProps & {
  active?: boolean,
  accent?: boolean,
  danger?: boolean,
  label?: ReactNode,
}>(({
  type = 'button',
  className,
  active,
  accent,
  danger,
  children,
  label,
  ...props
}, ref) => (
  <button
    ref={ref}
    type={type}
    data-active={active || undefined}
    data-accent={accent || undefined}
    data-danger={danger || undefined}
    className={joinClasses(styles['pillButton'], className)}
    // eslint-disable-next-line react/jsx-props-no-spreading
    {...props}
  >
    {children}
    {label != null && <span className={styles['pillButtonLabel']}>{label}</span>}
  </button>
));
PlayerPillButton.displayName = 'PlayerPillButton';

export const PlayerChipInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean,
  manual?: boolean,
  accentColor?: string,
  wrapperClassName?: string,
}>(({
  className,
  wrapperClassName,
  invalid,
  manual = true,
  accentColor,
  style,
  ...props
}, ref) => (
  <div
    data-invalid={invalid || undefined}
    data-manual={manual}
    className={joinClasses(styles['chipInputWrap'], wrapperClassName)}
    style={{ '--player-segment-accent': accentColor, ...style } as CSSProperties}
  >
    <input
      ref={ref}
      className={joinClasses(styles['chipInput'], className)}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    />
  </div>
));
PlayerChipInput.displayName = 'PlayerChipInput';

export function PlayerStat({
  label,
  value,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  label: ReactNode,
  value: ReactNode,
}) {
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <div className={joinClasses(styles['statBlock'], className)} {...props}>
      <span className={styles['statLabel']}>{label}</span>
      <span className={styles['statValue']}>{value}</span>
    </div>
  );
}

export function PlayerOverlayPopover({
  className,
  children,
}: {
  className?: string,
  children: ReactNode,
}) {
  return <div className={joinClasses(styles['overlayPopover'], className)}>{children}</div>;
}

export function PlayerOverlayColumn({
  className,
  children,
}: {
  className?: string,
  children: ReactNode,
}) {
  return <div className={joinClasses(styles['overlayColumn'], className)}>{children}</div>;
}

export function PlayerSrOnly({ children }: { children: ReactNode }) {
  return <span className={styles['srOnly']}>{children}</span>;
}

export const playerChromeStyles = styles;
