import React from "react";
import { Modal, View, Text, TouchableOpacity } from "react-native";

export default function VideoPlayerModal({ visible, videoId, onClose }) {
  const embedUrl =
    `https://www.youtube.com/embed/${videoId}` +
    `?autoplay=1&rel=0&showinfo=0&modestbranding=1&playsinline=1`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center" }}>
        <TouchableOpacity
          onPress={onClose}
          style={{ position: "absolute", top: 40, right: 20, zIndex: 10 }}
        >
          <Text style={{ color: "#fff", fontSize: 22 }}>✕</Text>
        </TouchableOpacity>
        <iframe
          src={embedUrl}
          style={{ width: "100%", height: 300, border: "none" }}
          allow="autoplay; encrypted-media; fullscreen"
          allowFullScreen
          title="video"
        />
      </View>
    </Modal>
  );
}
