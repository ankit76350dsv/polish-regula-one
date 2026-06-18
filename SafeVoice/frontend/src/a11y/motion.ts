// Respect the "reduce motion" accessibility setting.
//
// Some people get dizzy or distracted by moving content. Operating systems let them turn
// on a "reduce motion" setting. WCAG 2.1 (success criterion 2.3.3) says we should honour it.
// This helper checks that setting and, when it is on, strips the animation so the element
// simply appears instead of sliding or fading.
//
// Usage in a component:
//   const m = useMotionProps();
//   <motion.div {...m({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 } })} />

import { useReducedMotion } from "motion/react";

// The shape of the animation props we pass to a <motion.*> element.
export interface MotionProps {
  initial?: any;
  animate?: any;
  exit?: any;
  transition?: any;
}

export function useMotionProps(): (props: MotionProps) => MotionProps {
  // true when the user asked the system to reduce motion.
  const prefersReduced = useReducedMotion();

  return (props: MotionProps): MotionProps => {
    if (!prefersReduced) return props;
    // Reduced motion: keep the final ("animate") state but skip the moving start state
    // and make any transition instant, so content appears without sliding or fading.
    return {
      initial: false,
      animate: props.animate ?? {},
      exit: props.exit ? {} : undefined,
      transition: { duration: 0 }
    };
  };
}
