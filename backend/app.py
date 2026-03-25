from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import librosa
import numpy as np
import io
import base64
import os
from dotenv import load_dotenv

load_dotenv()

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
            model = tf.keras.models.load_model(model_path)
            print(f"Model loaded successfully from {model_path}")
        else:
            print(f"Model file not found at {model_path}")
            print("Please place your .keras model file in the backend/models/ directory")
    except Exception as e:
        print(f"Error loading model: {e}")

def preprocess_audio(audio_data, sample_rate=22050, duration=2.0):
    """Preprocess audio data for model input"""
    try:
        # Convert bytes to numpy array
        audio_bytes = base64.b64decode(audio_data)
        audio, sr = librosa.load(io.BytesIO(audio_bytes), sr=sample_rate)
        
        # Ensure consistent duration
        if len(audio) > sample_rate * duration:
            audio = audio[:int(sample_rate * duration)]
        else:
            audio = np.pad(audio, (0, int(sample_rate * duration) - len(audio)))
        
        # Extract features (MFCCs)
        mfccs = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=13, n_fft=2048, hop_length=512)
        
        # Add channel dimension and batch dimension
        mfccs = np.expand_dims(mfccs, axis=-1)  # Add channel dimension
        mfccs = np.expand_dims(mfccs, axis=0)  # Add batch dimension
        
        return mfccs
    except Exception as e:
        print(f"Error preprocessing audio: {e}")
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
        predictions = model.predict(processed_audio)
        
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
        return jsonify({'error': 'Classification failed'}), 500

if __name__ == '__main__':
    load_model()
    app.run(host='0.0.0.0', port=5000, debug=True)
