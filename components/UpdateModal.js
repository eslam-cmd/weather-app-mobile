import { Linking, Modal, Text, TouchableOpacity, View } from "react-native";

export default function UpdateModal({ visible, onClose, updateInfo }) {
  if (!updateInfo) return null;

  const { latestVersion, downloadUrl, forceUpdate } = updateInfo;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            width: "90%",
            backgroundColor: "#fff",
            borderRadius: 22,
            padding: 25,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 10 }}>
            تحديث متاح
          </Text>

          <Text
            style={{
              fontSize: 16,
              textAlign: "center",
              marginBottom: 25,
              color: "#555",
            }}
          >
            إصدار {latestVersion} متوفر الآن.
            {forceUpdate
              ? "يجب التحديث لمتابعة الاستخدام."
              : "التحديث اختياري."}
          </Text>

          <TouchableOpacity
            onPress={() => Linking.openURL(downloadUrl)}
            style={{
              backgroundColor: "#007AFF",
              paddingVertical: 12,
              borderRadius: 12,
              width: "100%",
              marginBottom: forceUpdate ? 0 : 15,
            }}
          >
            <Text
              style={{
                color: "#fff",
                fontSize: 17,
                fontWeight: "600",
                textAlign: "center",
              }}
            >
              تحديث الآن
            </Text>
          </TouchableOpacity>

          {!forceUpdate && (
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{
                  color: "#007AFF",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                لاحقًا
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}
