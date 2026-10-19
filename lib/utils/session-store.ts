// The session holds the bearer token, so it is persisted encrypted via
// expo-secure-store on native platforms. SecureStore has no web implementation,
// so web falls back to AsyncStorage (localStorage).
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SessionStore = {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  remove: (key: string) => Promise<void>;
};

const sessionStore: SessionStore =
  Platform.OS === 'web'
    ? {
        get: (key) => AsyncStorage.getItem(key),
        set: (key, value) => AsyncStorage.setItem(key, value),
        remove: (key) => AsyncStorage.removeItem(key),
      }
    : {
        // SecureStore keys allow only alphanumerics, '.', '-' and '_'.
        get: (key) => SecureStore.getItemAsync(key),
        set: (key, value) => SecureStore.setItemAsync(key, value),
        remove: (key) => SecureStore.deleteItemAsync(key),
      };

export { sessionStore };
