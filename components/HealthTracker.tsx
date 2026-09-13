import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Colors, Typography } from '@/constants/theme';

type HealthTrackerProps = {
  waterGlassesToday: number;
  onAddWater: () => void;
  onRemoveWater: () => void;
  onSaveBloodPressure: (systolic: number, diastolic: number, pulse?: number) => void;
  onSaveBloodSugar: (value: number) => void;
  lastSystolic?: number;
  lastDiastolic?: number;
  lastSugar?: number;
};

export function HealthTracker({
  waterGlassesToday,
  onAddWater,
  onRemoveWater,
  onSaveBloodPressure,
  onSaveBloodSugar,
  lastSystolic,
  lastDiastolic,
  lastSugar,
}: HealthTrackerProps) {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [sugar, setSugar] = useState('');

  const canSaveBp = useMemo(() => {
    const s = Number(systolic);
    const d = Number(diastolic);
    return Number.isFinite(s) && Number.isFinite(d) && s > 0 && d > 0;
  }, [systolic, diastolic]);

  const canSaveSugar = useMemo(() => {
    const v = Number(sugar);
    return Number.isFinite(v) && v > 0;
  }, [sugar]);

  return (
    <View style={styles.wrap}>
      <View style={styles.block}>
        <Text style={styles.heading}>Su Takibi</Text>
        <Text style={styles.value}>{waterGlassesToday} bardak</Text>
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Su azalt"
            onPress={onRemoveWater}
            style={[styles.stepBtn, styles.minusBtn]}
          >
            <Ionicons name="remove" size={32} color={Colors.text} />
            <Text style={styles.stepText}>Azalt</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Su ekle"
            onPress={onAddWater}
            style={[styles.stepBtn, styles.plusBtn]}
          >
            <Ionicons name="add" size={32} color={Colors.text} />
            <Text style={styles.stepText}>Artır</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.block}>
        <Text style={styles.heading}>Tansiyon</Text>
        {lastSystolic && lastDiastolic ? (
          <Text style={styles.lastReading}>
            Son: {lastSystolic}/{lastDiastolic}
          </Text>
        ) : null}
        <View style={styles.inputs}>
          <TextInput
            value={systolic}
            onChangeText={setSystolic}
            keyboardType="number-pad"
            placeholder="Büyük"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.slash}>/</Text>
          <TextInput
            value={diastolic}
            onChangeText={setDiastolic}
            keyboardType="number-pad"
            placeholder="Küçük"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />
          <TextInput
            value={pulse}
            onChangeText={setPulse}
            keyboardType="number-pad"
            placeholder="Nabız"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!canSaveBp) return;
            onSaveBloodPressure(
              Number(systolic),
              Number(diastolic),
              pulse ? Number(pulse) : undefined
            );
            setSystolic('');
            setDiastolic('');
            setPulse('');
          }}
          disabled={!canSaveBp}
          style={[styles.primaryBtn, !canSaveBp && styles.disabled]}
        >
          <Ionicons name="heart" size={28} color={Colors.text} />
          <Text style={styles.primaryBtnText}>Tansiyon Kaydet</Text>
        </Pressable>
      </View>

      <View style={styles.block}>
        <Text style={styles.heading}>Kan Şekeri</Text>
        {lastSugar ? (
          <Text style={styles.lastReading}>Son: {lastSugar} mg/dL</Text>
        ) : null}
        <TextInput
          value={sugar}
          onChangeText={setSugar}
          keyboardType="decimal-pad"
          placeholder="mg/dL"
          placeholderTextColor={Colors.textMuted}
          style={styles.inputFull}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (!canSaveSugar) return;
            onSaveBloodSugar(Number(sugar));
            setSugar('');
          }}
          disabled={!canSaveSugar}
          style={[styles.primaryBtn, styles.sugarBtn, !canSaveSugar && styles.disabled]}
        >
          <Ionicons name="water" size={28} color={Colors.text} />
          <Text style={styles.primaryBtnText}>Şeker Kaydet</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  block: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 12,
  },
  heading: {
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: '800',
  },
  value: {
    color: Colors.textMuted,
    fontSize: Typography.body,
    fontWeight: '700',
  },
  lastReading: {
    color: Colors.textMuted,
    fontSize: Typography.caption,
    fontWeight: '600',
  },
  row: { flexDirection: 'row', gap: 10 },
  stepBtn: {
    flex: 1,
    minHeight: 72,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  minusBtn: { backgroundColor: Colors.appointments },
  plusBtn: { backgroundColor: Colors.call },
  stepText: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '800',
  },
  inputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: Colors.bgSoft,
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  inputFull: {
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: Colors.bgSoft,
    color: Colors.text,
    fontSize: Typography.body,
    fontWeight: '700',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  slash: {
    color: Colors.text,
    fontSize: Typography.title,
    fontWeight: '800',
  },
  primaryBtn: {
    minHeight: 68,
    borderRadius: 14,
    backgroundColor: Colors.health,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sugarBtn: { backgroundColor: Colors.medicine },
  primaryBtnText: {
    color: Colors.text,
    fontSize: Typography.button,
    fontWeight: '800',
  },
  disabled: { opacity: 0.45 },
});
