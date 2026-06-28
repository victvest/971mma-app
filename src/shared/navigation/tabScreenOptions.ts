export function createTabScreenOptions() {
  return {
    headerShown: false,
    animation: 'none' as const,
    // Keep inactive tabs unmounted until first focus so cold launch only pays for
    // the active route. Already-visited tabs still freeze below for fast returns.
    lazy: true,
    // Freeze inactive tab JS trees so focus changes stay on the UI thread.
    freezeOnBlur: true,
  };
}
