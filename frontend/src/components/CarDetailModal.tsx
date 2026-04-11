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
import type {CarCardData} from './CarCard';

export interface DetailCarData extends CarCardData {
  year?: string;
  confidence?: string;
  model?: string;
}

interface CarDetailModalProps {
  visible: boolean;
  car: DetailCarData | null;
  onClose: () => void;
  isLiked?: boolean;
  onLikeToggle?: (id: string) => void;
}

const CarDetailModal: React.FC<CarDetailModalProps> = ({visible, car, onClose, isLiked, onLikeToggle}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [imageError, setImageError] = React.useState(false);

  // Reset error state when car changes
  React.useEffect(() => {
    setImageError(false);
  }, [car?.id]);

  if (!car) return null;

  const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';
  const dividerColor = isDarkMode ? '#333333' : '#e0e0e0';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, {backgroundColor: bgColor}]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {car.image && !imageError ? (
              <Image
                source={car.image}
                style={styles.image}
                resizeMode="cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.placeholderEmoji}>🚗</Text>
              </View>
            )}

            <View style={styles.content}>
              <View style={styles.nameRow}>
                <Text style={[styles.name, {color: textColor, flex: 1}]}>{car.name}</Text>
                {onLikeToggle && (
                  <TouchableOpacity
                    onPress={() => onLikeToggle(car.id)}
                    style={styles.likeButton}>
                    <Text style={styles.likeIcon}>{isLiked ? '♥' : '♡'}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.divider, {backgroundColor: dividerColor}]} />

              <View style={styles.detailRow}>
                <Text style={[styles.label, {color: subtextColor}]}>Make</Text>
                <Text style={[styles.value, {color: textColor}]}>{car.make || 'Unknown'}</Text>
              </View>

              {car.model && (
                <View style={styles.detailRow}>
                  <Text style={[styles.label, {color: subtextColor}]}>Model</Text>
                  <Text style={[styles.value, {color: textColor}]}>{car.model}</Text>
                </View>
              )}

              <View style={styles.detailRow}>
                <Text style={[styles.label, {color: subtextColor}]}>Type</Text>
                <Text style={[styles.value, {color: textColor}]}>{car.type || 'Unknown'}</Text>
              </View>

              {car.year && (
                <View style={styles.detailRow}>
                  <Text style={[styles.label, {color: subtextColor}]}>Year</Text>
                  <Text style={[styles.value, {color: textColor}]}>{car.year}</Text>
                </View>
              )}

              {car.confidence && (
                <View style={styles.detailRow}>
                  <Text style={[styles.label, {color: subtextColor}]}>Confidence</Text>
                  <Text style={[styles.value, {color: textColor}]}>{car.confidence}</Text>
                </View>
              )}
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  likeButton: {
    padding: 4,
    marginLeft: 12,
  },
  likeIcon: {
    fontSize: 24,
    color: '#ff4757',
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

export default CarDetailModal;
