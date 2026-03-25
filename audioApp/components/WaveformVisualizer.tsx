import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

interface WaveformVisualizerProps {
  isRecording: boolean;
  amplitude?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ 
  isRecording, 
  amplitude = 0 
}) => {
  const screenWidth = Dimensions.get('window').width;
  const barCount = 40;
  const barWidth = (screenWidth - 40) / barCount - 2;

  const generateBars = () => {
    const bars = [];
    for (let i = 0; i < barCount; i++) {
      const height = isRecording 
        ? Math.random() * 60 + 20 + (amplitude * 40) // Random height + amplitude influence
        : 5; // Minimal height when not recording
      
      bars.push(
        <View
          key={i}
          style={[
            styles.bar,
            {
              width: barWidth,
              height: isRecording ? height : 5,
              backgroundColor: isRecording ? '#4CAF50' : '#E0E0E0',
              opacity: isRecording ? 0.8 : 0.3,
            }
          ]}
        />
      );
    }
    return bars;
  };

  return (
    <View style={styles.container}>
      <View style={styles.waveformContainer}>
        {generateBars()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 80,
  },
  bar: {
    borderRadius: 2,
    marginHorizontal: 1,
  },
});
