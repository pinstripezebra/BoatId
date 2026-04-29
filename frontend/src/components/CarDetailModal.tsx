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
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type {CarCardData} from './CarCard';
import type {CarDetails, CarStatistics} from '../services/carApi';

export interface DetailCarData extends CarCardData {
  year?: string;
  confidence?: string;
  model?: string;
  identification_data?: CarDetails;
  car_statistics?: CarStatistics;
}

interface CarDetailModalProps {
  visible: boolean;
  car: DetailCarData | null;
  onClose: (editedFields?: Partial<CarDetails>) => void;
  isLiked?: boolean;
  onLikeToggle?: (id: string) => void;
  editable?: boolean;
  onDelete?: (carId: string) => Promise<void>;
}

const CarDetailModal: React.FC<CarDetailModalProps> = ({visible, car, onClose, isLiked, onLikeToggle, editable, onDelete}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const [imageError, setImageError] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValues, setEditValues] = React.useState<Partial<CarDetails>>({});
  const [showMenu, setShowMenu] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Reset state when car changes
  React.useEffect(() => {
    setImageError(false);
    setIsEditing(false);
    setEditValues({});
    setShowMenu(false);
    setIsDeleting(false);
  }, [car?.id]);

  if (!car) return null;

  const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#333333';
  const subtextColor = isDarkMode ? '#aaaaaa' : '#666666';
  const dividerColor = isDarkMode ? '#333333' : '#e0e0e0';
  const chipBg = isDarkMode ? '#2a2a2a' : '#f0f0f0';
  const inputBg = isDarkMode ? '#2a2a2a' : '#f5f5f5';
  const inputBorder = isDarkMode ? '#444444' : '#dddddd';

  const idData = car.identification_data;

  const getEditValue = (field: keyof CarDetails, fallback?: string) => {
    if (isEditing && field in editValues) {
      const val = editValues[field];
      return Array.isArray(val) ? val.join(', ') : (val ?? '');
    }
    return fallback ?? '';
  };

  const setEditField = (field: keyof CarDetails, value: string) => {
    setEditValues(prev => ({
      ...prev,
      [field]: field === 'features' ? value.split(',').map(s => s.trim()).filter(Boolean) : value,
    }));
  };

  const startEditing = () => {
    setEditValues({
      make: car.make || idData?.make || '',
      model: car.model || idData?.model || '',
      car_type: car.type || idData?.car_type || '',
      year: car.year || idData?.year || '',
      body_type: idData?.body_type || '',
      description: idData?.description || '',
      features: idData?.features || [],
    });
    setIsEditing(true);
  };

  const hasChanges = () => {
    if (!isEditing) return false;
    const orig: Record<string, any> = {
      make: car.make || idData?.make || '',
      model: car.model || idData?.model || '',
      car_type: car.type || idData?.car_type || '',
      year: car.year || idData?.year || '',
      body_type: idData?.body_type || '',
      description: idData?.description || '',
      features: idData?.features || [],
    };
    for (const key of Object.keys(editValues)) {
      const edited = editValues[key as keyof CarDetails];
      const original = orig[key];
      if (Array.isArray(edited) && Array.isArray(original)) {
        if (edited.join(',') !== original.join(',')) return true;
      } else if (edited !== original) {
        return true;
      }
    }
    return false;
  };

  const handleClose = () => {
    if (isEditing && hasChanges()) {
      onClose(editValues);
    } else {
      onClose();
    }
    setIsEditing(false);
    setEditValues({});
  };

  const handleDeletePress = () => {
    setShowMenu(false);
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image? This cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onDelete!(car!.id);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : 'Unknown error';
              Alert.alert('Error', `Failed to delete image: ${msg}`);
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const confidenceColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'high': return '#4caf50';
      case 'medium': return '#ff9800';
      case 'low': return '#f44336';
      default: return subtextColor;
    }
  };

  const renderField = (label: string, field: keyof CarDetails, displayValue?: string) => {
    const value = displayValue ?? (idData?.[field] as string | undefined) ?? '';
    if (!isEditing && !value) return null;
    return (
      <View style={styles.detailRow}>
        <Text style={[styles.label, {color: subtextColor}]}>{label}</Text>
        {isEditing ? (
          <TextInput
            style={[styles.editInput, {color: textColor, backgroundColor: inputBg, borderColor: inputBorder}]}
            value={getEditValue(field, value)}
            onChangeText={(text) => setEditField(field, text)}
            placeholderTextColor={subtextColor}
          />
        ) : (
          <Text style={[styles.value, {color: textColor}]}>{value || 'Unknown'}</Text>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => handleClose()}>
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
                {onDelete && (
                  <TouchableOpacity
                    onPress={() => setShowMenu(v => !v)}
                    style={styles.menuButton}
                    disabled={isDeleting}>
                    {isDeleting
                      ? <ActivityIndicator size="small" color="#666" />
                      : <Text style={[styles.menuIcon, {color: subtextColor}]}>⋮</Text>}
                  </TouchableOpacity>
                )}
              </View>

              {showMenu && (
                <View style={[styles.menuDropdown, {backgroundColor: isDarkMode ? '#2a2a2a' : '#ffffff'}]}>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleDeletePress}>
                    <Text style={styles.menuItemDelete}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}

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

              {renderField('Make', 'make', car.make || idData?.make)}
              {renderField('Model', 'model', car.model || idData?.model)}
              {renderField('Type', 'car_type', car.type || idData?.car_type)}
              {renderField('Year', 'year', car.year || idData?.year)}
              {renderField('Body Type', 'body_type', idData?.body_type)}

              {/* Description */}
              {(isEditing || idData?.description) && (
                <>
                  <View style={[styles.divider, {backgroundColor: dividerColor}]} />
                  <Text style={[styles.sectionTitle, {color: textColor}]}>Description</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.editInputMultiline, {color: textColor, backgroundColor: inputBg, borderColor: inputBorder}]}
                      value={getEditValue('description', idData?.description)}
                      onChangeText={(text) => setEditField('description', text)}
                      multiline
                      numberOfLines={3}
                      placeholderTextColor={subtextColor}
                    />
                  ) : (
                    <Text style={[styles.description, {color: subtextColor}]}>{idData?.description}</Text>
                  )}
                </>
              )}

              {/* Features */}
              {(isEditing || (idData?.features && idData.features.length > 0)) && (
                <>
                  <View style={[styles.divider, {backgroundColor: dividerColor}]} />
                  <Text style={[styles.sectionTitle, {color: textColor}]}>Features</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.editInput, {color: textColor, backgroundColor: inputBg, borderColor: inputBorder}]}
                      value={getEditValue('features', idData?.features?.join(', '))}
                      onChangeText={(text) => setEditField('features', text)}
                      placeholder="Comma-separated features"
                      placeholderTextColor={subtextColor}
                    />
                  ) : (
                    <View style={styles.chipContainer}>
                      {(Array.isArray(idData?.features) ? idData!.features : String(idData?.features ?? '').split(/[,\n]+/).map(s => s.trim()).filter(Boolean)).map((feature, idx) => (
                        <View key={idx} style={[styles.chip, {backgroundColor: chipBg}]}>
                          <Text style={[styles.chipText, {color: textColor}]}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {/* Car Statistics */}
              <>
                <View style={[styles.divider, {backgroundColor: dividerColor}]} />
                <Text style={[styles.sectionTitle, {color: textColor}]}>Car Statistics</Text>
                {car.car_statistics ? (
                  ([
                    ['Class',        car.car_statistics.car_class],
                    ['Cylinders',    car.car_statistics.cylinders?.toString()],
                    ['Displacement', car.car_statistics.displacement != null ? `${car.car_statistics.displacement}L` : null],
                    ['Drive',        car.car_statistics.drive?.toUpperCase()],
                    ['Fuel Type',    car.car_statistics.fuel_type],
                    ['Transmission', car.car_statistics.transmission === 'a' ? 'Automatic' : car.car_statistics.transmission === 'm' ? 'Manual' : car.car_statistics.transmission],
                    ['City MPG',     car.car_statistics.city_mpg],
                    ['Highway MPG',  car.car_statistics.highway_mpg],
                    ['Combined MPG', car.car_statistics.combination_mpg],
                  ] as [string, string | null | undefined][]).map(([label, val]) => (
                    <View key={label} style={styles.detailRow}>
                      <Text style={[styles.label, {color: subtextColor}]}>{label}</Text>
                      <Text style={[styles.value, {color: textColor}]}>{val ?? '—'}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={[styles.value, {color: subtextColor}]}>None</Text>
                )}
              </>
            </View>
          </ScrollView>

          <View style={styles.buttonRow}>
            {editable && !isEditing && (
              <TouchableOpacity style={styles.editButton} onPress={startEditing}>
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.closeButton, editable && !isEditing ? {flex: 1} : {flex: 1}]} onPress={handleClose}>
              <Text style={styles.closeButtonText}>{isEditing ? 'Save & Close' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
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
  menuButton: {
    padding: 4,
    marginLeft: 8,
    minWidth: 28,
    alignItems: 'center',
  },
  menuIcon: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  menuDropdown: {
    position: 'absolute',
    top: 36,
    right: 0,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 100,
    minWidth: 120,
    overflow: 'hidden',
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemDelete: {
    fontSize: 15,
    color: '#f44336',
    fontWeight: '600',
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
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    margin: 16,
  },
  editButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#ff9800',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  editInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 140,
  },
  editInputMultiline: {
    fontSize: 14,
    lineHeight: 22,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
});

export default CarDetailModal;
