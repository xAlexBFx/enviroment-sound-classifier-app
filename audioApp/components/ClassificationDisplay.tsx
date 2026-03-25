import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ClassificationResult } from '../services/ModelService';

interface ClassificationDisplayProps {
  result: ClassificationResult | null;
  isRecording: boolean;
  realTimeVolume: number;
}

export const ClassificationDisplay: React.FC<ClassificationDisplayProps> = ({ 
  result, 
  isRecording,
  realTimeVolume 
}) => {
  const volumeSizeAnim = React.useRef(new Animated.Value(60)).current; // Base radius

  // Always drive the ball from real-time mic volume (so it keeps moving even when results update)
  const displayVolume = React.useMemo(() => {
    return realTimeVolume;
  }, [realTimeVolume]);

  // Animate ball size based on display volume - smooth animated response
  React.useEffect(() => {
    // Bigger range for more dramatic size changes
    const targetSize = 60 + (displayVolume * 140); // 60-200px range (much more dramatic)
    
    // Smooth animated transition for natural movement
    Animated.timing(volumeSizeAnim, {
      toValue: targetSize,
      duration: 100, // 100ms smooth transition
      useNativeDriver: false, // Can't use native driver for size changes
    }).start();
  }, [displayVolume, volumeSizeAnim]);

  const getVolumeColor = useCallback((volume: number) => {
    // Always return white regardless of volume
    return '#FFFFFF';
  }, []);

  const formatClassName = useCallback((className: string) => {
    return className.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }, []);

  const topPredictions = useMemo(() => {
    if (!result) return [];
    return Object.entries(result.allProbabilities)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
  }, [result]);

  return (
    <View style={styles.container}>
      <View style={styles.statusContainer}>
        <View 
          style={[
            styles.recordingIndicator, 
            { 
              backgroundColor: isRecording ? getVolumeColor(displayVolume) : '#9E9E9E'
            }
          ]} 
        />
        <Text style={styles.statusText}>
          {isRecording ? 'Listening...' : 'Idle'}
        </Text>
      </View>

      {/* Classification results - moved above volume ball */}
      {result ? (
        <View style={styles.resultContainerTop}>
          <Text style={styles.classLabel}>Detected Sound:</Text>
          <Text style={styles.className}>{formatClassName(result.className)}</Text>

          <View style={styles.topPredictions}>
            <Text style={styles.topPredictionsTitle}>Top Predictions:</Text>
            {topPredictions.map(([className, probability], index) => (
              <View key={className} style={styles.predictionItem}>
                <Text style={styles.predictionName}>
                  {index + 1}. {formatClassName(className)}
                </Text>
                <Text style={styles.predictionProbability}>
                  {(probability * 100).toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.noResultContainerTop}>
          <Text style={styles.noResultText}>
            {isRecording ? 'Analyzing audio...' : 'Start recording to classify sounds'}
          </Text>
        </View>
      )}

      {/* Main volume ball - centered and prominent */}
      <View style={styles.volumeBallContainer}>
        <Animated.View 
          style={[
            styles.volumeBall,
            {
              backgroundColor: getVolumeColor(displayVolume),
              width: volumeSizeAnim,
              height: volumeSizeAnim,
              borderRadius: volumeSizeAnim
            }
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statusText: {
    fontSize: 16,
    color: '#ffffff',
  },
  volumeBallContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeBall: {
    backgroundColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  resultContainerTop: {
    alignItems: 'center',
    paddingVertical: 20,
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
  },
  classLabel: {
    fontSize: 16,
    color: '#b0b0b0',
    marginBottom: 8,
  },
  className: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 20,
    textTransform: 'capitalize',
  },
  topPredictions: {
    width: '100%',
  },
  topPredictionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  predictionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  predictionName: {
    fontSize: 14,
    color: '#b0b0b0',
    flex: 1,
    textTransform: 'capitalize',
  },
  predictionProbability: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
    width: 40,
    textAlign: 'right',
  },
  noResultContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  noResultContainerTop: {
    alignItems: 'center',
    paddingVertical: 20,
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
  },
  noResultText: {
    fontSize: 16,
    color: '#b0b0b0',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
