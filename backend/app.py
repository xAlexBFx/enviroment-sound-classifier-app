from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import io
import base64
import numpy as np
import librosa
from scipy import ndimage
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Try to import tensorflow/keras
# TF 2.16+ has keras as a separate package
try:
    import tensorflow as tf
    from keras.models import load_model as keras_load_model
except ImportError:
    import tensorflow as tf
    keras_load_model = tf.keras.models.load_model

app = Flask(__name__)
CORS(app)

# Global variables for model and class names
model = None
CLASS_NAMES = [
    'air_conditioner', 'car_horn', 'children_playing', 'dog_bark', 'drilling',
    'engine_idling', 'gun_shot', 'jackhammer', 'siren', 'street_music'
]

def load_model():
    """Load the Keras model"""
    global model
    try:
        model_path = os.path.join(os.path.dirname(__file__), 'models', 'urban_sound_model50.keras')
        if os.path.exists(model_path):
            model = keras_load_model(model_path)
            print(f"Model loaded successfully from {model_path}")
        else:
            print(f"Model file not found at {model_path}")
    except Exception as e:
        print(f"Error loading model: {e}")
        import traceback
        traceback.print_exc()

def preprocess_audio(audio_data, sample_rate=22050, duration=2.0):
    """Preprocess audio data for model input"""
    try:
        # Decode base64 to bytes
        audio_bytes = base64.b64decode(audio_data)
        
        # Convert bytes back to Float32Array
        audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
        
        # Ensure consistent duration (2 seconds = 44100 samples at 22050 Hz)
        target_length = int(sample_rate * duration)
        
        if len(audio_array) > target_length:
            audio = audio_array[:target_length]
        else:
            # Pad with zeros if too short
            audio = np.pad(audio_array, (0, target_length - len(audio_array)))
        
        # Extract mel spectrogram (not MFCC) - model expects 128 mel bins
        mel_spec = librosa.feature.melspectrogram(
            y=audio, 
            sr=sample_rate, 
            n_mels=128, 
            n_fft=2048, 
            hop_length=512
        )
        
        # Convert to dB scale
        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
        
        # Ensure correct shape: mel_spec_db is (128, 87) for 2 seconds
        # We need (128, 173) so we need to interpolate
        target_frames = 173
        if mel_spec_db.shape[1] != target_frames:
            from scipy import ndimage
            # Use zoom to resize
            zoom_factor = target_frames / mel_spec_db.shape[1]
            mel_spec_db = ndimage.zoom(mel_spec_db, (1, zoom_factor), order=1)
        
        # Add channel dimension and batch dimension
        mel_spec_db = np.expand_dims(mel_spec_db, axis=-1)  # Add channel dimension: (128, 173, 1)
        mel_spec_db = np.expand_dims(mel_spec_db, axis=0)   # Add batch dimension: (1, 128, 173, 1)
        

        return mel_spec_db
    except Exception as e:
        print(f"Error preprocessing audio: {e}")
        import traceback
        traceback.print_exc()
        return None

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'classes': CLASS_NAMES
    })

@app.route('/classify', methods=['POST'])
def classify_audio():
    """Classify audio endpoint"""
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        data = request.get_json()
        if not data or 'audio' not in data:
            return jsonify({'error': 'No audio data provided'}), 400
        
        # Preprocess audio
        processed_audio = preprocess_audio(data['audio'])
        if processed_audio is None:
            return jsonify({'error': 'Failed to preprocess audio'}), 400
        
        # Make prediction
        try:
            predictions = model.predict(processed_audio)
        except Exception as pred_error:
            print(f"Prediction error: {pred_error}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'Prediction failed: {str(pred_error)}'}), 500
        
        # Get top prediction and all probabilities
        predicted_class_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_class_idx])
        predicted_class = CLASS_NAMES[predicted_class_idx]
        
        # Create all probabilities dictionary
        all_probabilities = {}
        for i, class_name in enumerate(CLASS_NAMES):
            all_probabilities[class_name] = float(predictions[0][i])
        
        # Set to unknown if confidence is below 96%
        if confidence < 0.96:
            predicted_class = 'unknown'
        
        result = {
            'className': predicted_class,
            'confidence': confidence,
            'allProbabilities': all_probabilities
        }
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Error in classification: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Classification failed: {str(e)}'}), 500

if __name__ == '__main__':
    load_model()
    app.run(host='0.0.0.0', port=5000, debug=True)
