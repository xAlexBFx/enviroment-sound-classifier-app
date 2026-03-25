import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, View, Alert } from 'react-native';

import { ClassificationDisplay } from '@/components/ClassificationDisplay';
import { AudioRecorderComponent } from '@/components/AudioRecorder';
import { ClassificationService } from '@/services/ClassificationService';
import { ClassificationResult } from '@/services/ModelService';

// Change this to your backend URL - use your computer's IP address for mobile
const BACKEND_URL = 'http://10.153.9.160:5000';

export default function HomeScreen() {
  const classificationService = useMemo(() => new ClassificationService(BACKEND_URL), []);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [currentResult, setCurrentResult] = useState<ClassificationResult | null>(null);
  const [realTimeVolume, setRealTimeVolume] = useState(0);

  useEffect(() => {
    initializeService();
    
    return () => {
      classificationService.dispose();
    };
  }, [classificationService]);

  const handleStartRecording = useCallback(async () => {
    try {
      const started = await classificationService.startClassification((result) => {
        setCurrentResult(result);
      }, (volume) => {
        setRealTimeVolume(volume);
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


  const initializeService = useCallback(async () => {
    try {
      const initialized = await classificationService.initialize();
      if (!initialized) {
        Alert.alert(
          'Backend Connection Failed',
          `Cannot connect to backend at ${BACKEND_URL}. Please check:\n\n` +
          '1. Backend server is running\n' +
          '2. Your device is on the same network as the backend\n\n' +
          "Update BACKEND_URL in the code with your computer's IP address."
        );
      } else {
        // Automatically start recording after successful initialization
        handleStartRecording();
      }
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize the app');
    } finally {
      setIsInitializing(false);
    }
  }, [classificationService, handleStartRecording]);

  return (
    <View style={styles.container}>
      <ClassificationDisplay 
        result={currentResult} 
        isRecording={isRecording}
        realTimeVolume={realTimeVolume}
      />
      
      <AudioRecorderComponent
        isRecording={isRecording}
        isInitializing={isInitializing}
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
