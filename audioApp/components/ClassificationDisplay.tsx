import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { ClassificationResult } from '../services/ModelService';

interface ClassificationDisplayProps {
  result: ClassificationResult | null;
  isRecording: boolean;
}

export const ClassificationDisplay: React.FC<ClassificationDisplayProps> = ({ 
  result, 
  isRecording 
}) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (isRecording) {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.8) return '#4CAF50'; // Green
    if (confidence >= 0.6) return '#FF9800'; // Orange
    return '#F44336'; // Red
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
        <Animated.View 
          style={[
            styles.recordingIndicator, 
            { 
              transform: [{ scale: pulseAnim }],
              backgroundColor: isRecording ? '#4CAF50' : '#9E9E9E'
            }
          ]} 
        />
        <Text style={styles.statusText}>
          {isRecording ? 'Listening...' : 'Idle'}
        </Text>
      </View>

      {result ? (
        <View style={styles.resultContainer}>
          <Text style={styles.classLabel}>Detected Sound:</Text>
          <Text style={styles.className}>{formatClassName(result.className)}</Text>
          
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>Confidence:</Text>
            <Text style={[
              styles.confidenceValue,
              { color: getConfidenceColor(result.confidence) }
            ]}>
              {(result.confidence * 100).toFixed(1)}%
            </Text>
          </View>

          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { 
                  width: `${result.confidence * 100}%`,
                  backgroundColor: getConfidenceColor(result.confidence)
                }
              ]} 
            />
          </View>

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
        <View style={styles.noResultContainer}>
          <Text style={styles.noResultText}>
            {isRecording ? 'Analyzing audio...' : 'Start recording to classify sounds'}
          </Text>
        </View>
      )}
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
  resultContainer: {
    alignItems: 'center',
    paddingVertical: 20,
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
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  confidenceLabel: {
    fontSize: 16,
    color: '#b0b0b0',
    marginRight: 8,
  },
  confidenceValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#333333',
    borderRadius: 4,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
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
  },
  noResultText: {
    fontSize: 16,
    color: '#b0b0b0',
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
