import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useAuthStore } from '@/stores/useAuthStore';
import { usePersonaChat } from '../hooks/usePersonaChat';
import { usePersonaStore } from '../store/usePersonaStore';
import type { PersonaBubblePosition } from '../types';
import { PERSONA_BUBBLE_SIZE, PersonaFloatingBubble } from './PersonaFloatingBubble';
import { PersonaChatPanel } from './PersonaChatPanel';

const BUBBLE_EDGE_INSET = 16;

function computeDefaultPosition(
  width: number,
  height: number,
  tabBarBottom: number,
  tabBarHeight: number,
  safeTop: number,
): PersonaBubblePosition {
  return {
    x: width - PERSONA_BUBBLE_SIZE - BUBBLE_EDGE_INSET,
    y: Math.max(
      safeTop + 72,
      height - tabBarBottom - tabBarHeight - PERSONA_BUBBLE_SIZE - 28,
    ),
  };
}

export function PersonaAssistantHost() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const role = useAuthStore((state) => state.role);
  const insets = useSafeAreaInsets();
  const { tabBar, window } = useResponsiveLayout();
  const isChatOpen = usePersonaStore((state) => state.isChatOpen);
  const bubblePosition = usePersonaStore((state) => state.bubblePosition);
  const openChat = usePersonaStore((state) => state.openChat);
  const closeChat = usePersonaStore((state) => state.closeChat);
  const setBubblePosition = usePersonaStore((state) => state.setBubblePosition);
  const hydrateBubblePosition = usePersonaStore((state) => state.hydrateBubblePosition);
  const { messages, isTyping, sendMessage } = usePersonaChat();
  const hydratedRef = useRef(false);

  const isMemberSurface = isAuthenticated && role !== 'coach' && role !== 'admin';

  useEffect(() => {
    if (!isMemberSurface || hydratedRef.current) return;
    hydratedRef.current = true;
    void hydrateBubblePosition();
  }, [hydrateBubblePosition, isMemberSurface]);

  const bounds = useMemo(
    () => ({
      minX: BUBBLE_EDGE_INSET,
      maxX: window.width - PERSONA_BUBBLE_SIZE - BUBBLE_EDGE_INSET,
      minY: insets.top + 64,
      maxY:
        window.height -
        tabBar.bottom -
        tabBar.height -
        PERSONA_BUBBLE_SIZE -
        BUBBLE_EDGE_INSET,
    }),
    [insets.top, tabBar.bottom, tabBar.height, window.height, window.width],
  );

  const resolvedPosition = useMemo(() => {
    const fallback = computeDefaultPosition(
      window.width,
      window.height,
      tabBar.bottom,
      tabBar.height,
      insets.top,
    );

    if (!bubblePosition) return fallback;

    return {
      x: Math.min(Math.max(bubblePosition.x, bounds.minX), bounds.maxX),
      y: Math.min(Math.max(bubblePosition.y, bounds.minY), bounds.maxY),
    };
  }, [
    bounds.maxX,
    bounds.maxY,
    bounds.minX,
    bounds.minY,
    bubblePosition,
    insets.top,
    tabBar.bottom,
    tabBar.height,
    window.height,
    window.width,
  ]);

  const handlePositionChange = useCallback(
    (position: PersonaBubblePosition) => {
      setBubblePosition(position);
    },
    [setBubblePosition],
  );

  if (!isMemberSurface) return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <PersonaFloatingBubble
        position={resolvedPosition}
        visible={!isChatOpen}
        onOpenChat={openChat}
        onPositionChange={handlePositionChange}
        bounds={bounds}
      />
      <PersonaChatPanel
        visible={isChatOpen}
        messages={messages}
        isTyping={isTyping}
        onClose={closeChat}
        onSend={sendMessage}
      />
    </View>
  );
}
