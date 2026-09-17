import "./src/lib/polyfills";

import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "./src/contexts/AuthContext";
import { GoFitRoot } from "./src/navigation/GoFitRoot";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="transparent" translucent={true} />
      <AuthProvider>
        <GoFitRoot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
