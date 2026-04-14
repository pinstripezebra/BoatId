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
import type {CarDetails} from '../services/carApi';

export interface DetailCarData extends CarCardData {
  year?: string;
  confidence?: string;
  model?: string;
  identification_data?: CarDetails;
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
  const chipBg = isDarkMode ? '#2a2a2a' : '#f0f0f0';

  const idData = car.identification_data;

  const confidenceColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'low': return '#f44336';
      default: return subtextColor;
    }
  };

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

              {/* Confidence badge */}
              {car.confidence && (
                <View style={[styles.badge, {backgroundColor: confidenceColor(car.confidence) + '20'}]}>
                  <Text style={[styles.badgeText, {color: confidenceColor(car.confidence)}]}>
                    {car.confidence.charAt(0).toUpperCase() + car.confidence.slice(1)} Confidence
                  </Text>
                </View>
              )}

              <View style={[styles.divider, {backgroundColor: dividerColor}]} />

              {/* Core details */}
              <Text style={[styles.sectionTitle, {color: textColor}]}>Details</Text>

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
                <Text style={[styles.value, {color: textColor}]}>{car.type || idData?.car_type || 'Unknown'}</Text>
              </View>

              {(car.year || idData?.year) && (
                <View style={styles.detailRow}>
                  <Text style={[styles.label, {color: subtextColor}]}>Year</Text>
                  <Text style={[styles.value, {color: textColor}]}>{car.year || idData?.year}</Text>
                </View>
              )}

              {idData?.body_type && (
                <View style={styles.detailRow}>
                  <Text style={[styles.label, {color: subtextColor}]}>Body Type</Text>
                  <Text style={[styles.value, {color: textColor}]}>{idData.body_type}</Text>
                </View>
              )}

              {/* Description */}
              {idData?.description && (
                <>
                  <View style={[styles.divider, {backgroundColor: dividerColor}]} />
                  <Text style={[styles.sectionTitle, {color: textColor}]}>Description</Text>
                  <Text style={[styles.description, {color: subtextColor}]}>{idData.description}</Text>
                </>
              )}

              {/* Features */}
              {idData?.features && idData.features.length > 0 && (
                <>
                  <View style={[styles.divider, {backgroundColor: dividerColor}]} />
                  <Text style={[styles.sectionTitle, {color: textColor}]}>Features</Text>
                  <View style={styles.chipContainer}>
                    {(Array.isArray(idData.features) ? idData.features : String(idData.features).split(/[,\n]+/).map(s => s.trim()).filter(Boolean)).map((feature, idx) => (
                      <View key={idx} style={[styles.chip, {backgroundColor: chipBg}]}>
                        <Text style={[styles.chipText, {color: textColor}]}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </>
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
    maxHeight: '85%',
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
    flexShrink: 1,
    textAlign: 'right',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: {
    fontSize: 13,
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
