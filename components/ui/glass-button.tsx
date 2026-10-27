'use client';

import React from 'react';

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'ghost' | 'active' | 'subtle';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  contentClassName?: string;
  glow?: boolean;
  borderBeam?: boolean;
  asChild?: boolean;
}

/**
 * GlassButton
 * - Mengadopsi konsep Glassmorphism & Liquid Glass dari 21st.dev (@jahed/components/glass-button)
 * - Animated Button Border terinspirasi dari 21st.dev (@designali-in/components/button-border)
 * - Warna Hitam Glossy presisi dengan refleksi specular rim & gloss sheen
 */
export const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  (
    {
      children,
      className = '',
      contentClassName = '',
      variant = 'default',
      size = 'default',
      glow = false,
      borderBeam,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Tombol aksi utama (primary & success / save & generate) otomatis mengaktifkan animated border beam
    const hasBorderBeam = borderBeam ?? (variant === 'primary' || variant === 'success');

    // Size styles
    const sizeClasses = {
      sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
      default: 'h-10 px-4 text-xs md:text-sm rounded-xl gap-2',
      lg: 'h-12 px-6 text-sm md:text-base rounded-xl gap-2.5 font-semibold',
      icon: 'h-9 w-9 p-0 rounded-lg justify-center',
    }[size];

    // Variant styles: Primary & Success sekarang warna Hitam Glossy dengan animated border beam
    const variantClasses = {
      default:
        'bg-white/10 hover:bg-white/15 text-white/90 hover:text-white border-white/20 hover:border-white/35 shadow-[0_4px_20px_rgba(0,0,0,0.15),inset_0_1px_1px_rgba(255,255,255,0.25)]',
      subtle:
        'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border-white/10 hover:border-white/20 shadow-[0_2px_10px_rgba(0,0,0,0.1)]',
      primary:
        'bg-gradient-to-b from-neutral-900/95 via-black/90 to-neutral-950/95 text-white border-white/35 shadow-[0_10px_35px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.45),inset_0_-1px_2px_rgba(0,0,0,0.9)]',
      active:
        'bg-gradient-to-b from-neutral-900/95 via-black/90 to-neutral-950/95 text-white border-white/40 ring-1 ring-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.7),inset_0_1px_2px_rgba(255,255,255,0.45),inset_0_-1px_2px_rgba(0,0,0,0.9)]',
      success:
        'bg-gradient-to-b from-neutral-900/95 via-black/90 to-neutral-950/95 text-white border-white/35 shadow-[0_10px_35px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(255,255,255,0.45),inset_0_-1px_2px_rgba(0,0,0,0.9)]',
      danger:
        'bg-rose-500/25 hover:bg-rose-500/40 text-rose-100 hover:text-white border-rose-400/35 hover:border-rose-400/50 shadow-[0_4px_16px_rgba(244,63,94,0.25),inset_0_1px_1px_rgba(255,255,255,0.3)]',
      ghost:
        'bg-transparent hover:bg-white/10 text-white/70 hover:text-white border-transparent hover:border-white/15',
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={`
          group relative inline-flex items-center justify-center font-medium
          backdrop-blur-xl backdrop-saturate-150 border
          transition-all duration-200 ease-out select-none
          active:scale-[0.97]
          disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100
          overflow-hidden
          ${glow ? 'shadow-[0_0_30px_rgba(255,255,255,0.2)]' : ''}
          ${sizeClasses}
          ${variantClasses}
          ${className}
        `}
        {...props}
      >
        {/* Animated Border Beam (Reference: https://21st.dev/@designali-in/components/button-border) */}
        {hasBorderBeam && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-[2px] rounded-[inherit] overflow-hidden z-0"
            >
              <span
                aria-hidden="true"
                className="absolute inset-[-150%] animate-[spin_3.5s_linear_infinite] bg-[conic-gradient(from_0deg_at_50%_50%,transparent_0%,transparent_65%,rgba(255,255,255,0.3)_78%,rgba(255,255,255,0.95)_88%,transparent_100%)] opacity-90 group-hover:opacity-100 transition-opacity"
              />
            </span>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[1.5px] rounded-[inherit] bg-gradient-to-b from-neutral-900/95 via-black/90 to-neutral-950/95 z-[1]"
            />
          </>
        )}

        {/* Specular highlight rim: Garis bias tipis di tepi atas (refraksi kaca) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/70 to-transparent opacity-80 group-hover:opacity-100 transition-opacity z-[2]"
        />

        {/* Gloss sheen overlay gradient */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent opacity-70 group-hover:opacity-90 transition-opacity z-[2]"
        />

        {/* Content container dengan support contentClassName */}
        <span className={`relative z-10 flex items-center justify-center ${contentClassName}`}>
          {children}
        </span>
      </button>
    );
  }
);

GlassButton.displayName = 'GlassButton';

export default GlassButton;
