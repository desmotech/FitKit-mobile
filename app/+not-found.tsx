import { Link } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useCommonStrings } from '@/i18n/use-common-strings';

export default function NotFoundScreen() {
  const common = useCommonStrings();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center p-6 gap-3">
        <Text className="text-2xl font-display font-extrabold">
          {common.notFoundTitle}
        </Text>
        <Link href="/(tabs)" asChild>
          <Text className="text-primary font-semibold">
            {common.notFoundAction}
          </Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
