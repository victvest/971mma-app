const ANDROID_RELEASE_PROGUARD_RULES = `
# React Native / Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.** { *; }

# Reanimated / Worklets
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.worklets.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }

# Networking (Supabase / fetch → OkHttp)
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-keep class okio.** { *; }
-dontwarn okio.**

# react-native-svg
-keep class com.horcrux.svg.** { *; }
`.trim();

const DEFAULT_ANDROID_BUILD_ARCHS = [
  'armeabi-v7a',
  'arm64-v8a',
  'x86',
  'x86_64',
];

/** @type {readonly string[]} */
const ANDROID_DEVICE_BUILD_ARCHS = ['arm64-v8a'];

/** @type {readonly string[]} */
const ANDROID_EMULATOR_BUILD_ARCHS = ['x86_64'];

function parseAndroidBuildArchs() {
  const raw = process.env.ANDROID_BUILD_ARCHS?.trim();
  if (!raw) {
    return [...DEFAULT_ANDROID_BUILD_ARCHS];
  }

  return raw
    .split(',')
    .map((arch) => arch.trim())
    .filter(Boolean);
}

function getAndroidReleaseBuildProperties() {
  return {
    enableMinifyInReleaseBuilds: true,
    enableShrinkResourcesInReleaseBuilds: true,
    enablePngCrunchInReleaseBuilds: true,
    enableBundleCompression: true,
    buildArchs: parseAndroidBuildArchs(),
    extraProguardRules: ANDROID_RELEASE_PROGUARD_RULES,
  };
}

module.exports = {
  ANDROID_DEVICE_BUILD_ARCHS,
  ANDROID_EMULATOR_BUILD_ARCHS,
  getAndroidReleaseBuildProperties,
};
