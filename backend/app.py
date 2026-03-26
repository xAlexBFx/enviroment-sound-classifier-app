from flask import Flask, request, jsonify
from flask_cors import CORS
import base64
import numpy as np
import librosa
import tensorflow_hub as hub

app = Flask(__name__)
CORS(app)

yamnet_model = None
yamnet_class_names = None


def load_yamnet_classes():
    """Load YAMNet's 521 class names from CSV"""
    import csv
    import io
    
    # YAMNet class map CSV content
    csv_url = 'https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv'
    
    try:
        import urllib.request
        response = urllib.request.urlopen(csv_url)
        lines = response.read().decode('utf-8').strip().split('\n')
        
        classes = []
        reader = csv.reader(io.StringIO('\n'.join(lines)))
        next(reader)  # Skip header
        for row in reader:
            if len(row) >= 3:
                classes.append(row[2])  # Display name is 3rd column
        
        return classes
    except Exception as e:
        print(f"Could not load YAMNet classes from URL: {e}")
        # Fallback: return default class count
        return [f"class_{i}" for i in range(521)]


def load_yamnet():
    global yamnet_model, yamnet_class_names
    try:
        print("Loading YAMNet from TensorFlow Hub...")
        yamnet_model = hub.load('https://tfhub.dev/google/yamnet/1')
        print("YAMNet loaded successfully!")
        
        # Load class names
        yamnet_class_names = load_yamnet_classes()
        print(f"Loaded {len(yamnet_class_names)} YAMNet class names")
    except Exception as e:
        print(f"Error loading YAMNet: {e}")
        raise


def preprocess_audio(audio_data, sample_rate=22050):
    """Preprocess audio for YAMNet (expects 16kHz)"""
    try:
        audio_bytes = base64.b64decode(audio_data)
        audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
        
        # Resample to 16kHz for YAMNet
        if sample_rate != 16000 and len(audio_array) > 0:
            audio_array = librosa.resample(audio_array, orig_sr=sample_rate, target_sr=16000)
        
        # Normalize to [-1, 1]
        max_val = np.max(np.abs(audio_array))
        if max_val > 0:
            audio_array = audio_array / max_val
        
        return audio_array
    except Exception as e:
        print(f"Preprocessing error: {e}")
        return None


def map_yamnet_to_urban(yamnet_scores):
    """Map YAMNet AudioSet scores to urban sound classes"""
    urban_scores = np.zeros(len(CLASS_NAMES))
    
    for i, class_name in enumerate(CLASS_NAMES):
        indices = YAMNET_TO_URBAN.get(class_name, [])
        if indices:
            # Average the scores for mapped YAMNet classes
            valid_scores = [yamnet_scores[idx] for idx in indices if idx < len(yamnet_scores)]
            if valid_scores:
                urban_scores[i] = np.mean(valid_scores)
    
    # If all scores are low, use a fallback heuristic
    if urban_scores.sum() == 0:
        # Use some reasonable defaults based on common YAMNet classes
        urban_scores[0] = yamnet_scores[0] * 0.1  # Speech -> air_conditioner (weak)
        urban_scores[4] = yamnet_scores[347] * 0.8 if 347 < len(yamnet_scores) else 0  # drilling
        urban_scores[5] = yamnet_scores[343] * 0.8 if 343 < len(yamnet_scores) else 0  # engine_idling
        urban_scores[8] = yamnet_scores[389] * 0.9 if 389 < len(yamnet_scores) else 0  # siren
    
    # Normalize to sum to 1 (softmax-like)
    urban_scores = urban_scores / (urban_scores.sum() + 1e-8)
    
    return urban_scores


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'yamnet_loaded': yamnet_model is not None,
        'yamnet_classes': len(yamnet_class_names) if yamnet_class_names else 0
    })


@app.route('/classify', methods=['POST'])
def classify():
    """Main classification endpoint - returns top YAMNet AudioSet class"""
    if yamnet_model is None:
        return jsonify({'error': 'YAMNet not loaded'}), 500
    
    data = request.get_json()
    if not data or 'audio' not in data:
        return jsonify({'error': 'No audio data'}), 400
    
    audio = preprocess_audio(data['audio'])
    if audio is None:
        return jsonify({'error': 'Preprocessing failed'}), 400
    
    # Run YAMNet inference
    scores, embeddings, _ = yamnet_model(audio)
    avg_scores = scores.numpy().mean(axis=0)
    
    # Get top prediction from YAMNet's 521 classes
    predicted_idx = np.argmax(avg_scores)
    confidence = float(avg_scores[predicted_idx])
    predicted_class = yamnet_class_names[predicted_idx] if yamnet_class_names and predicted_idx < len(yamnet_class_names) else "unknown"
    
    # Get top 5 YAMNet predictions for display
    top_5_indices = avg_scores.argsort()[-5:][::-1]
    top_predictions = {
        yamnet_class_names[i] if yamnet_class_names and i < len(yamnet_class_names) else f"class_{i}": float(avg_scores[i])
        for i in top_5_indices
    }
    
    return jsonify({
        'className': predicted_class if confidence >= 0.15 else 'unknown',
        'confidence': confidence,
        'allProbabilities': top_predictions,
        'model': 'yamnet',
        'classIndex': int(predicted_idx),
        'totalClasses': len(yamnet_class_names) if yamnet_class_names else 521
    })


@app.route('/classify/raw', methods=['POST'])
def classify_raw():
    """Raw YAMNet classification (521 classes)"""
    if yamnet_model is None:
        return jsonify({'error': 'YAMNet not loaded'}), 500
    
    data = request.get_json()
    if not data or 'audio' not in data:
        return jsonify({'error': 'No audio data'}), 400
    
    audio = preprocess_audio(data['audio'])
    if audio is None:
        return jsonify({'error': 'Preprocessing failed'}), 400
    
    scores, embeddings, _ = yamnet_model(audio)
    avg_scores = scores.numpy().mean(axis=0)
    
    # Get top 5 predictions with class names
    top_5_indices = avg_scores.argsort()[-5:][::-1]
    top_5 = [
        {
            'className': yamnet_class_names[i] if yamnet_class_names and i < len(yamnet_class_names) else f"class_{i}",
            'classIndex': int(i),
            'confidence': float(avg_scores[i])
        }
        for i in top_5_indices
    ]
    
    return jsonify({
        'topPredictions': top_5,
        'model': 'yamnet',
        'totalClasses': len(yamnet_class_names) if yamnet_class_names else 521
    })


@app.route('/embeddings', methods=['POST'])
def embeddings():
    """Extract YAMNet embeddings for transfer learning"""
    if yamnet_model is None:
        return jsonify({'error': 'YAMNet not loaded'}), 500
    
    data = request.get_json()
    if not data or 'audio' not in data:
        return jsonify({'error': 'No audio data'}), 400
    
    audio = preprocess_audio(data['audio'])
    if audio is None:
        return jsonify({'error': 'Preprocessing failed'}), 400
    
    _, emb, _ = yamnet_model(audio)
    avg_embedding = emb.numpy().mean(axis=0).tolist()
    
    return jsonify({
        'embedding': avg_embedding,
        'dimensions': len(avg_embedding)
    })


if __name__ == '__main__':
    load_yamnet()
    app.run(host='0.0.0.0', port=5000, debug=True)
