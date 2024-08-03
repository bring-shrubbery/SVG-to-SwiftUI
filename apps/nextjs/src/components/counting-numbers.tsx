"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

export default function CountingNumbers({
  value,
  className,
  reverse = false,
  start = reverse ? 1000 : 0,
  interval = 10,
  duration = 800,
}: {
  value: number;
  className: string;
  reverse?: boolean;
  start?: number;
  interval?: number;
  duration?: number;
}) {
  const [number, setNumber] = useState(start);
  let increment = Math.floor(Math.abs(start - value) / (duration / interval));
  if (increment === 0) {
    increment = 1;
  }
  const ref = useRef(null);
  const isInView = useInView(ref);

  useEffect(() => {
    if (isInView) {
      const timer = setInterval(() => {
        if (reverse) {
          if (number > value) {
            setNumber((num) => {
              let newValue = num - increment;
              if (newValue < value) {
                newValue = value;
                if (typeof timer !== "undefined") clearInterval(timer);
              }
              return newValue;
            });
          } else if (typeof timer !== "undefined") {
            clearInterval(timer);
          }
        } else {
          if (number < value) {
            setNumber((num) => {
              let newValue = num + increment;
              if (newValue > value) {
                newValue = value;
                if (typeof timer !== "undefined") clearInterval(timer);
              }
              return newValue;
            });
          } else if (typeof timer !== "undefined") {
            clearInterval(timer);
          }
        }
      }, interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView]);

  return (
    <p className={className} ref={ref}>
      {Intl.NumberFormat().format(number)}
    </p>
  );
}
