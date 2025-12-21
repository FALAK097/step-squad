import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type Permission,
} from 'react-native-health-connect';

import { getTodayRange, type DateRange } from '../utils/date';

export type Availability = 'ready' | 'notInstalled' | 'notSupported';
export type PermissionState = 'granted' | 'denied';

const STEP_PERMISSION: Permission = {
  accessType: 'read',
  recordType: 'Steps',
};

const INSTALL_INTENT_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

export const HEALTH_CONNECT_PACKAGE = 'com.google.android.apps.healthdata';

export function getHealthConnectInstallUrl() {
  return INSTALL_INTENT_URL;
}

export async function getAvailability(): Promise<Availability> {
  const status = await getSdkStatus();
  switch (status) {
    case SdkAvailabilityStatus.SDK_AVAILABLE:
      return 'ready';
    case SdkAvailabilityStatus.SDK_UNAVAILABLE:
      return 'notInstalled';
    case SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED:
      return 'notSupported';
    default:
      return 'notSupported';
  }
}

export async function ensureInitialized(): Promise<boolean> {
  return initialize();
}

export async function hasStepPermission(): Promise<boolean> {
  const granted = await getGrantedPermissions();
  return granted.some(
    (permission) => permission.recordType === STEP_PERMISSION.recordType && permission.accessType === 'read'
  );
}

export async function requestStepPermission(): Promise<PermissionState> {
  const granted = await requestPermission([STEP_PERMISSION]);
  const hasPermission = granted.some(
    (permission) => permission.recordType === STEP_PERMISSION.recordType && permission.accessType === 'read'
  );

  return hasPermission ? 'granted' : 'denied';
}

export async function openHealthConnectAppSettings() {
  await openHealthConnectSettings();
}

export type StepReadResult = {
  totalSteps: number;
  records: Array<{ count: number }>;
};

export async function readStepsForRange(range?: DateRange): Promise<StepReadResult> {
  const { start, end } = range ?? getTodayRange();
  const { records } = await readRecords('Steps', {
    timeRangeFilter: {
      operator: 'between',
      startTime: start,
      endTime: end,
    },
  });

  const totalSteps = records.reduce((sum, record) => sum + record.count, 0);
  return { totalSteps, records };
}

export async function readTodaySteps() {
  return readStepsForRange(getTodayRange());
}
