import Constants from 'expo-constants';

/** Display label e.g. `v1.0.0(42)` */
export function getAppVersionLabel(): string {
  const version =
    Constants.expoConfig?.version ??
    Constants.nativeApplicationVersion ??
    '1.0.0';
  const build = Constants.nativeBuildVersion ?? '1';
  return `v${version}(${build})`;
}
