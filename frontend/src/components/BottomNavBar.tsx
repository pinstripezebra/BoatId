import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';

interface BottomNavBarProps {
  onCameraPress: () => void;
  isProcessing: boolean;
}

interface NavItemProps {
  icon: string;
  label: string;
  onPress?: () => void;
}

const NavItem: React.FC<NavItemProps & {textColor: string}> = ({
  icon,
  label,
  onPress,
  textColor,
}) => (
  <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.navIcon}>{icon}</Text>
    <Text style={[styles.navLabel, {color: textColor}]}>{label}</Text>
  </TouchableOpacity>
);

const BottomNavBar: React.FC<BottomNavBarProps> = ({
  onCameraPress,
  isProcessing,
}) => {
  const isDarkMode = useColorScheme() === 'dark';
  const bgColor = isDarkMode ? '#1e1e1e' : '#ffffff';
  const textColor = isDarkMode ? '#aaaaaa' : '#666666';
  const borderColor = isDarkMode ? '#333333' : '#e0e0e0';

  return (
    <View style={[styles.container, {backgroundColor: bgColor, borderTopColor: borderColor}]}>
      <NavItem icon="🏠" label="Home" textColor={textColor} />
      <NavItem icon="🔍" label="Search" textColor={textColor} />

      <TouchableOpacity
        style={[styles.cameraButton, isProcessing && styles.cameraButtonDisabled]}
        onPress={isProcessing ? undefined : onCameraPress}
        activeOpacity={0.8}>
        {isProcessing ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <Text style={styles.cameraIcon}>📷</Text>
        )}
      </TouchableOpacity>

      <NavItem icon="⭐" label="Favorites" textColor={textColor} />
      <NavItem icon="👤" label="Profile" textColor={textColor} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 20,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  navIcon: {
    fontSize: 22,
  },
  navLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  cameraButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196f3',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    elevation: 6,
    shadowColor: '#2196f3',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  cameraButtonDisabled: {
    backgroundColor: '#90CAF9',
  },
  cameraIcon: {
    fontSize: 24,
  },
});

export default BottomNavBar;
