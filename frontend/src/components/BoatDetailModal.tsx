import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ScrollView,
} from 'react-native';
import type {BoatCardData} from './BoatCard';

interface BoatDetailModalProps {
  visible: boolean;
  boat: BoatCardData | null;
  onClose: () => void;
}

const BoatDetailModal: React.FC<BoatDetailModalProps> = ({visible, boat, onClose}) => {
  const isDarkMode = useColorScheme() === 'dark';

  if (!boat) return null;

  const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';
  const dividerColor = isDarkMode ? '#333333' : '#e0e0e0';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, {backgroundColor: bgColor}]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {boat.image ? (
              <Image source={boat.image} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderEmoji}>🚤</Text>
              </View>
            )}

            <View style={styles.content}>
              <Text style={[styles.name, {color: textColor}]}>{boat.name}</Text>

              <View style={[styles.divider, {backgroundColor: dividerColor}]} />

              <View style={styles.detailRow}>
                <Text style={[styles.label, {color: subtextColor}]}>Make</Text>
                <Text style={[styles.value, {color: textColor}]}>{boat.make || 'Unknown'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={[styles.label, {color: subtextColor}]}>Type</Text>
                <Text style={[styles.value, {color: textColor}]}>{boat.type || 'Unknown'}</Text>
              </View>
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 220,
  },
  imagePlaceholder: {
    width: '100%',
    height: 220,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 64,
  },
  content: {
    padding: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#2196f3',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BoatDetailModal;
