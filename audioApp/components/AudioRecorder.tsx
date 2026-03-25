import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';

interface AudioRecorderComponentProps {
  isRecording: boolean;
  isInitializing: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export const AudioRecorderComponent: React.FC<AudioRecorderComponentProps> = ({
  isRecording,
  isInitializing,
  onStartRecording,
  onStopRecording,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.recordButton,
          isRecording ? styles.stopButton : styles.startButton,
        ]}
        onPress={isRecording ? onStopRecording : onStartRecording}
        disabled={isInitializing}
      >
        {isInitializing ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <View style={styles.buttonContent}>
            <View style={[
              styles.recordDot,
              isRecording ? styles.stopDot : styles.startDot
            ]} />
            <Text style={styles.buttonText}>
              {isRecording ? 'Stop' : 'Start'}
            </Text>
          </View>
        )}
      </TouchableOpacity>
      
      <Text style={styles.helperText}>
        {isRecording 
          ? 'Recording and classifying sounds every 4 seconds...'
          : 'Tap to start real-time sound classification'
        }
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  buttonDisabled: {
    backgroundColor: '#333333',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonContent: {
    alignItems: 'center',
  },
  recordDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 8,
  },
  startDot: {
    backgroundColor: '#ffffff',
  },
  stopDot: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  helperText: {
    textAlign: 'center',
    color: '#b0b0b0',
    fontSize: 14,
    paddingHorizontal: 20,
    maxWidth: 300,
  },
});
