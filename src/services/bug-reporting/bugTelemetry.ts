import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getAppVersionLabel } from '@/core/config/appVersion';
import { isSupabaseConfigured } from '@/core/config/env';
import { getSupabaseClient } from '@/services/supabase/client';
import { useAppConnectivityStore } from '@/stores/useAppConnectivityStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { sanitizeBugPayloadValue, sanitizeBugText } from './privacy';

export type BugEventSeverity = 'fatal' | 'error' | 'warning' | 'info';

export type BugEventSource =
  | 'global_error'
  | 'unhandled_promise'
  | 'react_error_boundary'
  | 'console_error'
  | 'console_warn'
  | 'query_error'
  | 'mutation_error'
  | 'api_error'
  | 'manual';

type BreadcrumbLevel = 'debug' | 'info' | 'warning' | 'error';

export type BugBreadcrumb = {
  at: string;
  category: string;
  message: string;
  level: BreadcrumbLevel;
  data?: unknown;
};

export type CaptureBugEventInput = {
  source: BugEventSource;
  severity?: BugEventSeverity;
  title?: string;
  message?: string;
  error?: unknown;
  stack?: string | null;
  context?: Record<string, unknown>;
  fingerprint?: string;
};

type BugEventPayload = {
  severity: BugEventSeverity;
  source: BugEventSource;
  title: string;
  message: string;
  stack?: string | null;
  route?: string | null;
  release?: string | null;
  appVersion?: string | null;
  appBuild?: string | null;
  runtimeVersion?: string | null;
  platform?: string | null;
  osVersion?: string | null;
  deviceName?: string | null;
  connectionType?: string | null;
  isOnline?: boolean | null;
  breadcrumbs: BugBreadcrumb[];
  context: Record<string, unknown>;
  fingerprint?: string | null;
};

type ErrorUtilsLike = {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

const MAX_BREADCRUMBS = 40;
const MAX_PENDING_EVENTS = 30;
const DEDUPE_WINDOW_MS = 15_000;
const FAILED_SUBMIT_BACKOFF_MS = 60_000;

const breadcrumbs: BugBreadcrumb[] = [];
const pendingEvents: BugEventPayload[] = [];
const recentFingerprints = new Map<string, number>();

let currentRoute: string | null = null;
let installed = false;
let flushing = false;
let nextSubmitAttemptAt = 0;
let sessionId: string | null = null;

function createSessionId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${random}`;
}

function getSessionId(): string {
  if (!sessionId) sessionId = createSessionId();
  return sessionId;
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name || 'Error',
      message: error.message || 'Unexpected error',
      stack: error.stack ?? null,
    };
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return {
      name: sanitizeBugText(record.name ?? record.code ?? 'Error'),
      message: sanitizeBugText(
        record.message ?? record.error_description ?? record.details ?? record,
      ),
      stack: typeof record.stack === 'string' ? record.stack : null,
    };
  }

  return {
    name: 'Error',
    message: sanitizeBugText(error || 'Unexpected error'),
    stack: null,
  };
}

function getConstantsValue(key: string): string | null {
  const constants = Constants as unknown as Record<string, unknown>;
  const value = constants[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function getRuntimeVersion(): string | null {
  const runtimeVersion = Constants.expoConfig?.runtimeVersion;
  if (typeof runtimeVersion === 'string') return runtimeVersion;
  if (runtimeVersion && typeof runtimeVersion === 'object' && 'policy' in runtimeVersion) {
    return String(runtimeVersion.policy);
  }
  return null;
}

function getAppVersion(): string | null {
  return Constants.expoConfig?.version ?? Constants.nativeApplicationVersion ?? null;
}

function getAppBuild(): string | null {
  return Constants.nativeBuildVersion ?? null;
}

function computeFingerprint(input: CaptureBugEventInput, message: string): string {
  if (input.fingerprint) return input.fingerprint;
  const stackTop = input.stack ?? normalizeError(input.error).stack ?? '';
  return [
    input.source,
    input.severity ?? 'error',
    currentRoute ?? 'unknown-route',
    sanitizeBugText(message).slice(0, 220),
    stackTop.split('\n').slice(0, 2).join('|'),
  ].join(':');
}

function shouldDropDuplicate(fingerprint: string): boolean {
  const now = Date.now();
  const recentUntil = recentFingerprints.get(fingerprint) ?? 0;
  if (recentUntil > now) return true;

  recentFingerprints.set(fingerprint, now + DEDUPE_WINDOW_MS);
  for (const [key, expiresAt] of recentFingerprints.entries()) {
    if (expiresAt <= now) recentFingerprints.delete(key);
  }
  return false;
}

function buildPayload(input: CaptureBugEventInput): BugEventPayload {
  const normalizedError = normalizeError(input.error);
  const message = sanitizeBugText(input.message ?? normalizedError.message);
  const title = sanitizeBugText(input.title ?? normalizedError.name ?? message).slice(0, 180);
  const authState = useAuthStore.getState();
  const connectivity = useAppConnectivityStore.getState();

  return {
    severity: input.severity ?? 'error',
    source: input.source,
    title: title || 'App error',
    message: message || title || 'Unexpected error',
    stack: input.stack ?? normalizedError.stack,
    route: currentRoute,
    release: getAppVersionLabel(),
    appVersion: getAppVersion(),
    appBuild: getAppBuild(),
    runtimeVersion: getRuntimeVersion(),
    platform: Platform.OS,
    osVersion: String(Platform.Version ?? ''),
    deviceName: getConstantsValue('deviceName'),
    connectionType: connectivity.connectionType,
    isOnline: connectivity.networkStatusKnown ? connectivity.isOnline : null,
    breadcrumbs: breadcrumbs.slice(-MAX_BREADCRUMBS),
    context: sanitizeBugPayloadValue({
      ...input.context,
      sessionId: getSessionId(),
      appFocused: connectivity.isAppFocused,
      networkStatusKnown: connectivity.networkStatusKnown,
      userRole: authState.role,
      accountStatus: authState.user?.accountStatus ?? null,
      errorName: normalizedError.name,
    }) as Record<string, unknown>,
    fingerprint: computeFingerprint(input, message),
  };
}

async function hasAuthenticatedSession(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return Boolean(data.session?.user?.id);
  } catch {
    return false;
  }
}

async function flushPendingBugEvents(): Promise<void> {
  if (flushing || pendingEvents.length === 0) return;
  if (Date.now() < nextSubmitAttemptAt) return;

  flushing = true;
  try {
    if (!(await hasAuthenticatedSession())) return;

    const supabase = getSupabaseClient();
    while (pendingEvents.length > 0) {
      const payload = pendingEvents[0];
      const { error } = await supabase.rpc('submit_bug_event', {
        p_payload: payload,
      });

      if (error) {
        nextSubmitAttemptAt = Date.now() + FAILED_SUBMIT_BACKOFF_MS;
        return;
      }

      pendingEvents.shift();
    }
  } catch {
    nextSubmitAttemptAt = Date.now() + FAILED_SUBMIT_BACKOFF_MS;
  } finally {
    flushing = false;
  }
}

function enqueuePayload(payload: BugEventPayload): void {
  if (payload.fingerprint && shouldDropDuplicate(payload.fingerprint)) return;

  pendingEvents.push(payload);
  if (pendingEvents.length > MAX_PENDING_EVENTS) {
    pendingEvents.splice(0, pendingEvents.length - MAX_PENDING_EVENTS);
  }

  void flushPendingBugEvents();
}

function serializeConsoleArgs(args: unknown[]): Record<string, unknown> {
  return {
    args: args.map((arg) => sanitizeBugPayloadValue(arg)),
  };
}

function installConsoleProxy() {
  const methods: Array<{
    method: 'debug' | 'info' | 'log' | 'warn' | 'error';
    level: BreadcrumbLevel;
    eventSource?: BugEventSource;
    eventSeverity?: BugEventSeverity;
  }> = [
    { method: 'debug', level: 'debug' },
    { method: 'info', level: 'info' },
    { method: 'log', level: 'info' },
    { method: 'warn', level: 'warning', eventSource: 'console_warn', eventSeverity: 'warning' },
    { method: 'error', level: 'error', eventSource: 'console_error', eventSeverity: 'error' },
  ];

  for (const config of methods) {
    const original = console[config.method].bind(console);
    console[config.method] = (...args: unknown[]) => {
      original(...args);
      const message = sanitizeBugText(args[0] ?? config.method);
      recordBugBreadcrumb('console', message, serializeConsoleArgs(args), config.level);

      if (config.eventSource) {
        captureBugEvent({
          source: config.eventSource,
          severity: config.eventSeverity,
          title: message.slice(0, 180),
          message,
          error: args.find((arg) => arg instanceof Error),
          context: serializeConsoleArgs(args),
        });
      }
    };
  }
}

function installGlobalErrorHandler() {
  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    captureBugEvent({
      source: 'global_error',
      severity: isFatal ? 'fatal' : 'error',
      error,
      context: { isFatal: Boolean(isFatal) },
    });

    previousHandler?.(error, isFatal);
  });
}

function installUnhandledPromiseHandler() {
  const runtime = globalThis as typeof globalThis & {
    addEventListener?: (eventName: string, handler: (event: unknown) => void) => void;
  };

  if (typeof runtime.addEventListener !== 'function') return;

  runtime.addEventListener('unhandledrejection', (event: unknown) => {
    const reason =
      event && typeof event === 'object' && 'reason' in event
        ? (event as { reason?: unknown }).reason
        : event;

    captureBugEvent({
      source: 'unhandled_promise',
      severity: 'error',
      error: reason,
      context: { event: sanitizeBugPayloadValue(event) },
    });
  });
}

function installAuthFlushSubscription() {
  useAuthStore.subscribe((state) => {
    if (state.user?.id) {
      void flushPendingBugEvents();
    }
  });
}

export function recordBugBreadcrumb(
  category: string,
  message: string,
  data?: unknown,
  level: BreadcrumbLevel = 'info',
): void {
  breadcrumbs.push({
    at: new Date().toISOString(),
    category,
    message: sanitizeBugText(message),
    level,
    data: data === undefined ? undefined : sanitizeBugPayloadValue(data),
  });

  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.splice(0, breadcrumbs.length - MAX_BREADCRUMBS);
  }
}

export function setBugTelemetryRoute(route: string): void {
  if (currentRoute === route) return;
  currentRoute = route;
  recordBugBreadcrumb('navigation', route, undefined, 'info');
}

export function captureBugEvent(input: CaptureBugEventInput): void {
  const payload = buildPayload(input);
  enqueuePayload(payload);
}

export function flushBugTelemetry(): Promise<void> {
  return flushPendingBugEvents();
}

export function installBugTelemetry(): void {
  if (installed) return;
  installed = true;

  installConsoleProxy();
  installGlobalErrorHandler();
  installUnhandledPromiseHandler();
  installAuthFlushSubscription();
}
