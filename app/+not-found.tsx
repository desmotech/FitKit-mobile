import { Link } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';

export default function NotFoundScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-3">
        <Text className="text-2xl font-display font-extrabold">
          Page not found
        </Text>
        <Link href="/(tabs)" asChild>
          <Text className="text-primary font-semibold">Go home</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
