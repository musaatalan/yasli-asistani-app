export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relation?: string;
  photoUri?: string;
  isPrimary?: boolean;
};

export type QuickContact = {
  id: string;
  name: string;
  phone: string;
  photoUri?: string;
};

export type Medicine = {
  id: string;
  name: string;
  dosage: string;
  times: string[];
  notes?: string;
  enabled: boolean;
};

export type BloodPressureReading = {
  id: string;
  systolic: number;
  diastolic: number;
  pulse?: number;
  recordedAt: string;
};

export type BloodSugarReading = {
  id: string;
  value: number;
  unit: 'mg/dL' | 'mmol/L';
  recordedAt: string;
  note?: string;
};

export type WaterLog = {
  id: string;
  glasses: number;
  date: string;
};

export type Appointment = {
  id: string;
  title: string;
  doctor?: string;
  location?: string;
  datetime: string;
  notes?: string;
};

export type SensorSettings = {
  fallDetectionEnabled: boolean;
  fallSensitivity: 'low' | 'medium' | 'high';
  loudNoiseDetectionEnabled: boolean;
  loudNoiseThresholdDb: number;
  fallCountdownSeconds: number;
};

export type AppSettings = {
  userName: string;
  settingsPin: string;
  emergencyMessage: string;
  sensors: SensorSettings;
};

export type AppState = {
  settings: AppSettings;
  emergencyContacts: EmergencyContact[];
  quickContacts: QuickContact[];
  medicines: Medicine[];
  bloodPressure: BloodPressureReading[];
  bloodSugar: BloodSugarReading[];
  waterLogs: WaterLog[];
  appointments: Appointment[];
};

export type SosResult = {
  smsOpened: boolean;
  smsSentCount: number;
  smsFailedCount: number;
  calledPhone: string | null;
  locationAttached: boolean;
  message: string;
  error?: string;
};
