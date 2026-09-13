import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Colors, Layout, Typography } from '@/constants/theme';

type BigButtonProps = {
  title: string;
  subtitle?: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  loading?: boolean;
  disabled?: boolean;
};

export function BigButton({
  title,
  subtitle,
  color,
  icon,
  onPress,
  style,
  loading = false,
  disabled = false,
}: BigButtonProps) {
  const handlePress = async () => {
    if (disabled || loading) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onPress();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: color, opacity: pressed || disabled ? 0.85 : 1 },
        style,
      ]}
    >
      <View style={styles.iconWrap}>
        {loading ? (
          <ActivityIndicator color={Colors.text} size="large" />
        ) : (
          <Ionicons name={icon} size={44} color={Colors.text} />
        )}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
    minHeight: Layout.buttonMinHeight,
    borderRadius: Layout.buttonRadius,
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  iconWrap: {
    marginBottom: 10,
    height: 48,
    justifyContent: 'center',
  },
  title: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.85)',
    fontSize: Typography.caption,
    fontWeight: '600',
    textAlign: 'center',
  },
});
