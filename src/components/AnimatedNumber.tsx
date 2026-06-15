import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, TextStyle } from 'react-native';
import { motion } from '../theme/motion';

type Props = {
  value: number;
  duration?: number;
  style?: StyleProp<TextStyle>;
  formatter?: (n: number) => string;
};

/** Count-up number with eased tween — pairs with StatRing and success states. */
export function AnimatedNumber({
  value,
  duration = motion.duration.slow,
  style,
  formatter = (n) => String(Math.round(n)),
}: Props) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisplay(v));
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: motion.easing.expoOut,
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [anim, duration, value]);

  return <Animated.Text style={style}>{formatter(display)}</Animated.Text>;
}
