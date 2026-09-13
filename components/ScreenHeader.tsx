import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Typography } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  showBack?: boolean;
  rightLabel?: string;
  onRightPress?: () => void;
};

export function ScreenHeader({
  title,
  showBack = true,
  rightLabel,
  onRightPress,
}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {showBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Geri"
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={12}
        >
          <Ionicons name="arrow-back" size={28} color={Colors.text} />
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {rightLabel && onRightPress ? (
        <Pressable
          accessibilityRole="button"
          onPress={onRightPress}
          style={styles.rightBtn}
        >
          <Text style={styles.rightText}>{rightLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 8,
  },
  backBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  spacer: {
    width: 52,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: '800',
  },
  rightBtn: {
    minWidth: 52,
    height: 52,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  rightText: {
    color: Colors.text,
    fontSize: Typography.caption,
    fontWeight: '700',
  },
});
