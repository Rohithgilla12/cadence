import auth from '@react-native-firebase/auth';
import { ApiClient } from '@/lib/api';

const baseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const apiClient = new ApiClient({
  baseUrl,
  getToken: async () => {
    const current = auth().currentUser;
    return current ? current.getIdToken() : null;
  },
});
