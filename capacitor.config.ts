import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.vruguard.sentinel",
  appName: "VRU Sentinel",
  webDir: "dist",
  server: {
    cleartext: true,
  },
  plugins: {
    Geolocation: {
      locationAlways: true,
    },
  },
};

export default config;
