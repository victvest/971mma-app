import { Redirect } from 'expo-router';

export default function PrivacyScreen() {
  return <Redirect href="/legal?tab=privacy" />;
}
