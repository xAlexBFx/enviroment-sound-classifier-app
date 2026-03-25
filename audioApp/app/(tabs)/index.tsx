import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Alert } from 'react-native';

import { ClassificationDisplay } from '@/components/ClassificationDisplay';
import { AudioRecorderComponent } from '@/components/AudioRecorder';
import { ClassificationService } from '@/services/ClassificationService';
import { ClassificationResult } from '@/services/ModelService';

export default function HomeScreen() {
  const classificationService = useMemo(() => new ClassificationService(), []);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [currentResult, setCurrentResult] = useState<ClassificationResult | null>(null);

  useEffect(() => {
    initializeService();
    
    return () => {
      classificationService.dispose();
    };
  }, [classificationService]);

  const initializeService = useCallback(async () => {
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
  }, [classificationService]);

  const handleStartRecording = useCallback(async () => {
    try {
      const started = await classificationService.startClassification((result) => {
        setCurrentResult(result);
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
  }, [classificationService]);

  const handleStopRecording = useCallback(async () => {
    try {
      await classificationService.stopClassification();
      setIsRecording(false);
    } catch (error) {
      console.error('Stop recording error:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  }, [classificationService]);

  return (
    <View style={styles.container}>
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
    backgroundColor: '#121212',
  },
});
