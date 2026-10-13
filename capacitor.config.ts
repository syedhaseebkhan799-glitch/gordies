import type { CapacitorConfig } from "@capacitor/cli";

// Android app: wraps the static build in out/.
const config: CapacitorConfig = {
  appId: "com.gordies.app",
  appName: "Gordies",
  webDir: "out",
};

export default config;
