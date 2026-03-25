import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native';

import { ClassificationDisplay } from '@/components/ClassificationDisplay';
import { WaveformVisualizer } from '@/components/WaveformVisualizer';
import { AudioRecorderComponent } from '@/components/AudioRecorder';
import { ClassificationService } from '@/services/ClassificationService';
import { ClassificationResult } from '@/services/ModelService';

export default function HomeScreen() {
  const [classificationService] = useState(() => new ClassificationService());
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [currentResult, setCurrentResult] = useState<ClassificationResult | null>(null);
  const [amplitude, setAmplitude] = useState(0);

  useEffect(() => {
    initializeService();
    
    return () => {
      classificationService.dispose();
    };
  }, []);

  const initializeService = async () => {
    try {
      const initialized = await classificationService.initialize();
      if (!initialized) {
        Alert.alert('Error', 'Failed to initialize classification service');
      }
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize the app');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleStartRecording = async () => {
    try {
      const started = await classificationService.startClassification((result) => {
        setCurrentResult(result);
        // Simulate amplitude based on confidence
        setAmplitude(result.confidence);
      });
      
      if (started) {
        setIsRecording(true);
      } else {
        Alert.alert('Error', 'Failed to start recording');
      }
    } catch (error) {
      console.error('Start recording error:', error);
      Alert.alert('Error', 'Failed to start sound classification');
    }
  };

  const handleStopRecording = async () => {
    try {
      await classificationService.stopClassification();
      setIsRecording(false);
      setAmplitude(0);
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  return (
    <View style={styles.container}>
      <WaveformVisualizer isRecording={isRecording} amplitude={amplitude} />
      
      <ClassificationDisplay 
        result={currentResult} 
        isRecording={isRecording} 
      />
      
      <AudioRecorderComponent
        isRecording={isRecording}
        isInitializing={isInitializing}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
