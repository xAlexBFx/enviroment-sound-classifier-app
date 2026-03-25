import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AudioRecorderComponentProps {
  isRecording: boolean;
  isInitializing: boolean;
}

export const AudioRecorderComponent: React.FC<AudioRecorderComponentProps> = ({
  isRecording,
  isInitializing,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.helperText}>
        {isInitializing 
          ? 'Initializing sound classification...'
          : isRecording 
            ? 'Recording and classifying sounds...'
            : 'Sound classification active'
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
  helperText: {
    textAlign: 'center',
    color: '#b0b0b0',
    fontSize: 14,
    paddingHorizontal: 20,
    maxWidth: 300,
  },
});
