# 9.1: Animation System

**Effort:** Low | **Status:** Complete

## Background

The UI has no animation system — modals appear instantly, there are no loading skeletons, and no visual cues for state changes. This subphase establishes a lightweight CSS animation foundation used by Parts 3–4 (running indicators, loading states in detail modal).

## Tasks

### 1A. CSS Keyframes + Utility Classes

- [x] Edit `src/renderer/src/assets/main.css` — add after scrollbar styling:

```css
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); }
  50% { box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3); }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@layer utilities {
  .animate-fade-in { animation: fade-in 150ms ease-out both; }
  .animate-slide-up { animation: slide-up 200ms ease-out both; }
  .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
  .animate-shimmer {
    background: linear-gradient(90deg, var(--cos-bg-tertiary) 25%, var(--cos-bg-hover) 50%, var(--cos-bg-tertiary) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }
}
```

### 1B. Apply Animations to Modal

- [x] Edit `src/renderer/src/components/shared/Modal.tsx`:
  - Add `animate-fade-in` to the overlay div
  - Add `animate-slide-up` to the dialog div

### 1C. Create Skeleton Component

- [x] Create `src/renderer/src/components/shared/Skeleton.tsx`
  - Accepts `lines` prop (number of shimmer bars to render)
  - Each bar uses `animate-shimmer` utility class
  - Configurable height/width for different use cases

## Files

| File | Action |
|------|--------|
| `src/renderer/src/assets/main.css` | EDIT — keyframes + utility classes |
| `src/renderer/src/components/shared/Modal.tsx` | EDIT — fade-in + slide-up |
| `src/renderer/src/components/shared/Skeleton.tsx` | CREATE |

## Success Criteria

- [x] Four keyframe animations defined: fade-in, slide-up, pulse-glow, shimmer
- [x] Four utility classes available: `.animate-fade-in`, `.animate-slide-up`, `.animate-pulse-glow`, `.animate-shimmer`
- [x] Modal overlay fades in, dialog slides up when opened
- [x] Skeleton component renders configurable shimmer bars
