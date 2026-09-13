import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Typography } from '@/constants/theme';

type EmergencyCardProps = {
  name: string;
  phone: string;
  relation?: string;
  photoUri?: string;
  isPrimary?: boolean;
  onCall: () => void;
  onSms?: () => void;
  onPickPhoto?: () => void;
  onDelete?: () => void;
};

export function EmergencyCard({
  name,
  phone,
  relation,
  photoUri,
  isPrimary,
  onCall,
  onSms,
  onPickPhoto,
  onDelete,
}: EmergencyCardProps) {
  return (
    <View style={[styles.card, isPrimary && styles.primaryCard]}>
      <View style={styles.row}>
        <Pressable
          onPress={onPickPhoto}
          disabled={!onPickPhoto}
          accessibilityRole={onPickPhoto ? 'button' : undefined}
          accessibilityLabel="Fotoğraf seç"
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera" size={32} color={Colors.text} />
              {onPickPhoto ? (
                <Text style={styles.photoHint}>Foto</Text>
              ) : null}
            </View>
          )}
        </Pressable>

        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          {relation ? <Text style={styles.relation}>{relation}</Text> : null}
          <Text style={styles.phone}>{phone || 'Numara eklenmedi'}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name} ara`}
          onPress={onCall}
          style={[styles.actionBtn, styles.callBtn]}
        >
          <Ionicons name="call" size={30} color={Colors.text} />
          <Text style={styles.actionText}>ARA</Text>
        </Pressable>

        {onSms ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${name} SMS`}
            onPress={onSms}
            style={[styles.actionBtn, styles.smsBtn]}
          >
            <Ionicons name="chatbubble" size={26} color={Colors.text} />
            <Text style={styles.actionText}>SMS</Text>
          </Pressable>
        ) : null}
      </View>

      {onDelete ? (
        <Pressable onPress={onDelete} style={styles.deleteBtn}>
          <Text style={styles.deleteText}>Kişiyi sil</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 14,
  },
  primaryCard: {
    borderColor: Colors.sos,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 14,
  },
  photoPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: Colors.bgSoft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 2,
  },
  photoHint: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 4,
  },
  name: {
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: '800',
  },
  relation: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    fontWeight: '600',
  },
  phone: {
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callBtn: {
    backgroundColor: Colors.call,
  },
  smsBtn: {
    backgroundColor: Colors.medicine,
  },
  actionText: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '800',
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  deleteText: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    fontWeight: '700',
  },
});
