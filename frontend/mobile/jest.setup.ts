const secureStore: Record<string, string> = {};
const asyncStore: Record<string, string> = {};

const routerMock = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
  setParams: jest.fn(),
};

jest.mock('react-native', () => {
  const eventListeners: Record<string, ((payload: unknown) => void)[]> = {};

  return {
    ActivityIndicator: 'ActivityIndicator',
    Alert: { alert: jest.fn() },
    Animated: {
      Value: jest.fn(() => ({
        interpolate: jest.fn(),
        setValue: jest.fn(),
      })),
      timing: jest.fn(() => ({ start: jest.fn((callback) => callback?.()) })),
      View: 'Animated.View',
    },
    AppState: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      currentState: 'active',
    },
    Button: 'Button',
    DeviceEventEmitter: {
      addListener: jest.fn((event: string, listener: (payload: unknown) => void) => {
        eventListeners[event] = [...(eventListeners[event] || []), listener];
        return {
          remove: jest.fn(() => {
            eventListeners[event] = (eventListeners[event] || []).filter((item) => item !== listener);
          }),
        };
      }),
      emit: jest.fn((event: string, payload: unknown) => {
        (eventListeners[event] || []).forEach((listener) => listener(payload));
      }),
    },
    Dimensions: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      get: jest.fn(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 })),
    },
    FlatList: 'FlatList',
    Image: 'Image',
    Keyboard: { dismiss: jest.fn() },
    Linking: {
      addEventListener: jest.fn(() => ({ remove: jest.fn() })),
      canOpenURL: jest.fn(async () => true),
      openURL: jest.fn(async () => undefined),
    },
    Modal: 'Modal',
    Platform: {
      OS: 'ios',
      select: jest.fn((options) => options?.ios ?? options?.default),
    },
    Pressable: 'Pressable',
    RefreshControl: 'RefreshControl',
    ScrollView: 'ScrollView',
    SectionList: 'SectionList',
    StyleSheet: {
      absoluteFillObject: {},
      create: jest.fn((styles) => styles),
      flatten: jest.fn((style) => style),
      hairlineWidth: 1,
    },
    Switch: 'Switch',
    Text: 'Text',
    TextInput: 'TextInput',
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
    useColorScheme: jest.fn(() => 'light'),
  };
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  clear: jest.fn(async () => {
    Object.keys(asyncStore).forEach((key) => delete asyncStore[key]);
  }),
  getItem: jest.fn(async (key: string) => asyncStore[key] ?? null),
  removeItem: jest.fn(async (key: string) => {
    delete asyncStore[key];
  }),
  setItem: jest.fn(async (key: string, value: string) => {
    asyncStore[key] = value;
  }),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    appOwnership: 'expo',
    expoConfig: { hostUri: undefined, extra: { eas: { projectId: 'test-project' } } },
    manifest: {},
    manifest2: {},
  },
}));

jest.mock('expo-device', () => ({
  isDevice: false,
}));

jest.mock('expo-notifications', () => ({
  getExpoPushTokenAsync: jest.fn(async () => ({ data: 'ExponentPushToken[test]' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
}));

jest.mock('expo-router', () => ({
  router: routerMock,
  useLocalSearchParams: jest.fn(() => ({})),
  useRouter: jest.fn(() => routerMock),
}));

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(async (key: string) => {
    delete secureStore[key];
  }),
  getItemAsync: jest.fn(async (key: string) => secureStore[key] ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    secureStore[key] = value;
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(secureStore).forEach((key) => delete secureStore[key]);
  Object.keys(asyncStore).forEach((key) => delete asyncStore[key]);
  global.fetch = jest.fn();
});
