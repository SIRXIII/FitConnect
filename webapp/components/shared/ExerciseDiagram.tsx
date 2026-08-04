import { useState } from 'react';

interface ExerciseDiagramProps {
  exerciseKey: string | null;
  muscleGroup?: string;
  size?: number;
  className?: string;
}

export default function ExerciseDiagram({
  exerciseKey,
  muscleGroup = 'core',
  size = 48,
  className,
}: ExerciseDiagramProps) {
  const fallbackSrc = `/assets/exercises/_fallback/${muscleGroup}.svg`;
  const initialSrc = exerciseKey
    ? `/assets/exercises/${exerciseKey}.svg`
    : fallbackSrc;

  const [src, setSrc] = useState(initialSrc);

  function handleError() {
    if (!src.includes('_fallback')) {
      setSrc(fallbackSrc);
    }
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      onError={handleError}
      className={className}
    />
  );
}
