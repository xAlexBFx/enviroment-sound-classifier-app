import React, { useState } from 'react';
import { StyleSheet, View, ScrollView, Text, Switch, Alert } from 'react-native';

export default function SettingsScreen() {
  const [autoStart, setAutoStart] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  const [highQualityMode, setHighQualityMode] = useState(false);

  const handleResetSettings = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setAutoStart(false);
            setShowNotifications(true);
            setHighQualityMode(false);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recording Settings</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Auto-start recording</Text>
            <Switch
              value={autoStart}
              onValueChange={setAutoStart}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={autoStart ? '#fff' : '#f4f3f4'}
            />
          </View>

          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>High quality mode</Text>
            <Switch
              value={highQualityMode}
              onValueChange={setHighQualityMode}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={highQualityMode ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingLabel}>Show classification alerts</Text>
            <Switch
              value={showNotifications}
              onValueChange={setShowNotifications}
              trackColor={{ false: '#767577', true: '#4CAF50' }}
              thumbColor={showNotifications ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model Information</Text>
          <Text style={styles.infoText}>Model: Urban Sound Classifier</Text>
          <Text style={styles.infoText}>Classes: 10 sound categories</Text>
          <Text style={styles.infoText}>Sample Rate: 22050 Hz</Text>
          <Text style={styles.infoText}>Duration: 4 seconds</Text>
          <Text style={styles.infoText}>Processing: Mel Spectrogram</Text>
          <Text style={styles.infoText}>Version: 1.0.0</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.infoText}>Real-time sound classification app</Text>
          <Text style={styles.infoText}>100% offline processing</Text>
          <Text style={styles.infoText}>No data sent to servers</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.resetButton} onPress={handleResetSettings}>
            Reset All Settings
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    margin: 15,
    padding: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  infoText: {
    fontSize: 16,
    color: '#666',
    paddingVertical: 4,
  },
  resetButton: {
    fontSize: 16,
    color: '#F44336',
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 15,
  },
});
