import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';

interface WaveformVisualizerProps {
  isRecording: boolean;
  amplitude?: number;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ 
  isRecording, 
  amplitude = 0 
}) => {
  const barAnimations = useRef<Animated.Value[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const barCount = 40; // Reduced from 50 for better performance
  const screenWidth = Dimensions.get('window').width;
  const barWidth = Math.max(2, (screenWidth - 60) / barCount - 1);

  // Initialize animations once
  useEffect(() => {
    if (barAnimations.current.length === 0) {
      barAnimations.current = Array(barCount).fill(null).map(() => new Animated.Value(0));
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Optimized animation using requestAnimationFrame
  const animateBars = useCallback(() => {
    if (!isRecording) return;

    const now = Date.now();
    // Throttle updates to 60fps (16ms)
    if (now - lastUpdateTime.current < 16) {
      animationFrameId.current = requestAnimationFrame(animateBars);
      return;
    }
    
    lastUpdateTime.current = now;

    const baseHeight = amplitude * 60;
    const time = now * 0.001; // Convert to seconds

    const animations = barAnimations.current.map((anim, index) => {
      // More efficient wave calculation
      const wavePhase = (index / barCount) * Math.PI * 2 + time * 2;
      const waveOffset = Math.sin(wavePhase) * 15;
      const targetHeight = Math.max(5, baseHeight + waveOffset);
      
      return Animated.timing(anim, {
        toValue: targetHeight,
        duration: 0, // Immediate update for smoother animation
        useNativeDriver: false,
      });
    });

    Animated.parallel(animations).start(() => {
      if (isRecording) {
        animationFrameId.current = requestAnimationFrame(animateBars);
      }
    });
  }, [isRecording, amplitude]);

  useEffect(() => {
    if (isRecording) {
      animateBars();
    } else {
      // Cancel any pending animation frame
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      
      // Reset bars efficiently
      const resetAnimations = barAnimations.current.map(anim =>
        Animated.timing(anim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        })
      );
      Animated.parallel(resetAnimations).start();
    }
  }, [isRecording, animateBars]);

  const generateBars = useCallback(() => {
    return barAnimations.current.map((anim, index) => (
      <Animated.View
        key={index}
        style={[
          styles.bar,
          {
            width: barWidth,
            height: anim,
            backgroundColor: isRecording ? '#4CAF50' : '#333333',
            opacity: isRecording ? 0.9 : 0.3,
          }
        ]}
      />
    ));
  }, [isRecording, barWidth]);

  return (
    <View style={styles.container}>
      <View style={styles.waveformContainer}>
        {generateBars()}
      </View>
      <View style={styles.centerLine} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 120,
    backgroundColor: '#1e1e1e',
    margin: 20,
    borderRadius: 10,
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 80,
    width: '100%',
  },
  bar: {
    borderRadius: 2,
    marginHorizontal: 0.5,
  },
  centerLine: {
    position: 'absolute',
    left: 15,
    right: 15,
    height: 1,
    backgroundColor: '#333333',
    top: '50%',
  },
});
