import { useAuth } from '@clerk/clerk-expo';
import { Redirect } from 'expo-router';
import { FKScreenLoader } from '@/components/fk/loading-bar';

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <FKScreenLoader />;
  }

  return isSignedIn ? (
    <Redirect href="/(tabs)" />
  ) : (
    <Redirect href="/(auth)/sign-in" />
  );
}
