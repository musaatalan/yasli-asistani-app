import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  AppSettings,
  Appointment,
  BloodPressureReading,
  BloodSugarReading,
  EmergencyContact,
  Medicine,
  QuickContact,
  WaterLog,
} from '@/types';

type AppStore = {
  settings: AppSettings;
  emergencyContacts: EmergencyContact[];
  quickContacts: QuickContact[];
  medicines: Medicine[];
  bloodPressure: BloodPressureReading[];
  bloodSugar: BloodSugarReading[];
  waterLogs: WaterLog[];
  appointments: Appointment[];
  settingsUnlocked: boolean;
  onboardingCompleted: boolean;

  updateSettings: (partial: Partial<AppSettings>) => void;
  setSettingsUnlocked: (value: boolean) => void;
  completeOnboarding: () => void;
  verifyPin: (pin: string) => boolean;

  setEmergencyContacts: (contacts: EmergencyContact[]) => void;
  upsertEmergencyContact: (contact: EmergencyContact) => void;
  setQuickContacts: (contacts: QuickContact[]) => void;
  addQuickContact: (contact: Omit<QuickContact, 'id'> & { id?: string }) => void;
  updateQuickContact: (id: string, patch: Partial<QuickContact>) => void;
  removeQuickContact: (id: string) => void;

  setMedicines: (medicines: Medicine[]) => void;
  addMedicine: (medicine: Omit<Medicine, 'id'>) => void;
  toggleMedicine: (id: string) => void;
  removeMedicine: (id: string) => void;

  addBloodPressure: (reading: Omit<BloodPressureReading, 'id'>) => void;
  addBloodSugar: (reading: Omit<BloodSugarReading, 'id'>) => void;
  setWaterGlasses: (date: string, glasses: number) => void;
  addWaterGlass: (date: string) => void;
  removeWaterGlass: (date: string) => void;

  setAppointments: (appointments: Appointment[]) => void;
};

const defaultSettings: AppSettings = {
  userName: 'Kullanıcı',
  settingsPin: '1234',
  emergencyMessage:
    'ACİL DURUM! Güvenli Yaşlı Asistanı uygulamasından yardım çağrısı. Lütfen hemen arayın.',
  sensors: {
    fallDetectionEnabled: true,
    fallSensitivity: 'medium',
    loudNoiseDetectionEnabled: false,
    loudNoiseThresholdDb: 85,
    fallCountdownSeconds: 10,
  },
};

function upsertWater(logs: WaterLog[], date: string, glasses: number): WaterLog[] {
  const clamped = Math.max(0, glasses);
  const existing = logs.find((log) => log.date === date);
  if (existing) {
    return logs.map((log) => (log.date === date ? { ...log, glasses: clamped } : log));
  }
  if (clamped === 0) return logs;
  return [...logs, { id: Date.now().toString(), date, glasses: clamped }];
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      emergencyContacts: [
        {
          id: '1',
          name: 'Acil Yakınım',
          phone: '',
          relation: 'Aile',
          isPrimary: true,
        },
      ],
      quickContacts: [],
      medicines: [],
      bloodPressure: [],
      bloodSugar: [],
      waterLogs: [],
      appointments: [],
      settingsUnlocked: false,
      onboardingCompleted: false,

      updateSettings: (partial) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...partial,
            sensors: partial.sensors
              ? { ...state.settings.sensors, ...partial.sensors }
              : state.settings.sensors,
          },
        })),

      setSettingsUnlocked: (value) => set({ settingsUnlocked: value }),

      completeOnboarding: () => set({ onboardingCompleted: true }),

      verifyPin: (pin) => {
        const ok = pin === get().settings.settingsPin;
        if (ok) set({ settingsUnlocked: true });
        return ok;
      },

      setEmergencyContacts: (contacts) => set({ emergencyContacts: contacts }),

      upsertEmergencyContact: (contact) =>
        set((state) => {
          const idx = state.emergencyContacts.findIndex((c) => c.id === contact.id);
          if (idx === -1) {
            return { emergencyContacts: [...state.emergencyContacts, contact] };
          }
          const next = [...state.emergencyContacts];
          next[idx] = contact;
          return { emergencyContacts: next };
        }),

      setQuickContacts: (contacts) => set({ quickContacts: contacts }),

      addQuickContact: (contact) =>
        set((state) => ({
          quickContacts: [
            ...state.quickContacts,
            { ...contact, id: contact.id ?? Date.now().toString() },
          ],
        })),

      updateQuickContact: (id, patch) =>
        set((state) => ({
          quickContacts: state.quickContacts.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          ),
        })),

      removeQuickContact: (id) =>
        set((state) => ({
          quickContacts: state.quickContacts.filter((c) => c.id !== id),
        })),

      setMedicines: (medicines) => set({ medicines }),

      addMedicine: (medicine) =>
        set((state) => ({
          medicines: [...state.medicines, { ...medicine, id: Date.now().toString() }],
        })),

      toggleMedicine: (id) =>
        set((state) => ({
          medicines: state.medicines.map((m) =>
            m.id === id ? { ...m, enabled: !m.enabled } : m
          ),
        })),

      removeMedicine: (id) =>
        set((state) => ({
          medicines: state.medicines.filter((m) => m.id !== id),
        })),

      addBloodPressure: (reading) =>
        set((state) => ({
          bloodPressure: [
            { ...reading, id: Date.now().toString() },
            ...state.bloodPressure,
          ].slice(0, 100),
        })),

      addBloodSugar: (reading) =>
        set((state) => ({
          bloodSugar: [
            { ...reading, id: `${Date.now()}_bs` },
            ...state.bloodSugar,
          ].slice(0, 100),
        })),

      setWaterGlasses: (date, glasses) =>
        set((state) => ({
          waterLogs: upsertWater(state.waterLogs, date, glasses),
        })),

      addWaterGlass: (date) => {
        const current =
          get().waterLogs.find((log) => log.date === date)?.glasses ?? 0;
        get().setWaterGlasses(date, current + 1);
      },

      removeWaterGlass: (date) => {
        const current =
          get().waterLogs.find((log) => log.date === date)?.glasses ?? 0;
        get().setWaterGlasses(date, current - 1);
      },

      setAppointments: (appointments) => set({ appointments }),
    }),
    {
      name: 'yasli-asistani-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        settings: state.settings,
        emergencyContacts: state.emergencyContacts,
        quickContacts: state.quickContacts,
        medicines: state.medicines,
        bloodPressure: state.bloodPressure,
        bloodSugar: state.bloodSugar,
        waterLogs: state.waterLogs,
        appointments: state.appointments,
        onboardingCompleted: state.onboardingCompleted,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppStore>;
        const contacts = p.emergencyContacts ?? current.emergencyContacts;
        const hasPhone = contacts.some(
          (c) => (c.phone ?? '').replace(/\D/g, '').length >= 7
        );
        // Eski kurulumda numara varsa kurulum ekranını atla
        const onboardingCompleted =
          p.onboardingCompleted === true ||
          (p.onboardingCompleted !== false && hasPhone);

        return {
          ...current,
          ...p,
          onboardingCompleted,
          settings: {
            ...current.settings,
            ...(p.settings ?? {}),
            sensors: {
              ...current.settings.sensors,
              ...(p.settings?.sensors ?? {}),
            },
          },
          bloodSugar: p.bloodSugar ?? current.bloodSugar,
        };
      },
    }
  )
);
