import { Redirect } from 'expo-router';

export default function TermsScreen() {
  return <Redirect href="/legal?tab=terms" />;
}
