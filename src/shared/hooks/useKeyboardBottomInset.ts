import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from 'react-native';

function readKeyboardInset(event: KeyboardEvent): number {
  if (Platform.OS === 'android') {
    const windowHeight = Dimensions.get('window').height;
    const keyboardTop = event.endCoordinates.screenY;
    return Math.max(0, windowHeight - keyboardTop);
  }

  return event.endCoordinates.height;
}

export function useKeyboardBottomInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const showEvents =
      Platform.OS === 'ios'
        ? (['keyboardWillShow', 'keyboardDidShow'] as const)
        : (['keyboardDidShow'] as const);
    const hideEvents =
      Platform.OS === 'ios'
        ? (['keyboardWillHide', 'keyboardDidHide'] as const)
        : (['keyboardDidHide'] as const);

    const showSubs = showEvents.map((event) =>
      Keyboard.addListener(event, (keyboardEvent) => {
        setInset(readKeyboardInset(keyboardEvent));
      }),
    );

    const hideSubs = hideEvents.map((event) =>
      Keyboard.addListener(event, () => {
        setInset(0);
      }),
    );

    return () => {
      showSubs.forEach((subscription) => subscription.remove());
      hideSubs.forEach((subscription) => subscription.remove());
    };
  }, []);

  return inset;
}
