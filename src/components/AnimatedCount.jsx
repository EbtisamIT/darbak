import React, { useEffect, useRef, useState } from "react";

export default function AnimatedCount({
  value = 0,
  duration = 800,
  prefix = "",
  suffix = "",
  locale = "en-US",
}) {
  const safeValue = Math.max(0, Number(value) || 0);
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    const startValue = previousValueRef.current;
    const endValue = safeValue;
    const startTime = performance.now();
    let animationFrameId;

    const animate = (currentTime) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(
        startValue + (endValue - startValue) * easedProgress
      );

      setDisplayValue(nextValue);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      } else {
        previousValueRef.current = endValue;
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [duration, safeValue]);

  return (
    <>
      {prefix}
      {displayValue.toLocaleString(locale)}
      {suffix}
    </>
  );
}
