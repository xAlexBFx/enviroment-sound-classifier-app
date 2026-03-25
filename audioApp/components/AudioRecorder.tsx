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
    alignItems: 'center',
    paddingVertical: 20,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
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
    backgroundColor: '#fff',
  },
  stopDot: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  helperText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    paddingHorizontal: 20,
    maxWidth: 300,
  },
});
