import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";

export default function VideoPlayerModal({ visible, videoId, onClose }) {
  const source = {
    uri: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Close video">
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
          <WebView source={source} style={styles.video} allowsFullscreenVideo />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 16 },
  sheet: { height: 240, backgroundColor: "#111827", borderRadius: 16, overflow: "hidden" },
  closeButton: { position: "absolute", zIndex: 2, right: 12, top: 8, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  closeText: { color: "#FFFFFF", fontSize: 26, lineHeight: 30 },
  video: { flex: 1, backgroundColor: "#000000" },
});
