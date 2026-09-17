import { StyleSheet } from "react-native";
import { ROSE, SH } from "./constants";

const S = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#070B14",
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 20,
    padding: 16,
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  heading: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  input: {
    backgroundColor: "#1E2837",
    borderRadius: 12,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.08)",
    minHeight: 50,
  },
  inputFocused: {
    borderColor: ROSE,
    backgroundColor: "rgba(255,107,53,0.05)",
  },
  primaryBtn: {
    backgroundColor: ROSE,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  primaryBtnTxt: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryBtn: {
    backgroundColor: "#1E2837",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  secondaryBtnTxt: {
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
    fontSize: 15,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#111827",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: SH * 0.88,
  },
  nutritionCard: {
    backgroundColor: "#1E2837",
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.25)",
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});

export default S;
