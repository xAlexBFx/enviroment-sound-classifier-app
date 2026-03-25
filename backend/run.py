#!/usr/bin/env python3
"""
Production runner for the sound classification backend
"""

import os
import sys
from app import app, load_model

def main():
    """Main entry point for production"""
    
    # Load the model before starting the server
    print("Loading model...")
    load_model()
    
    if not os.getenv('FLASK_ENV'):
        os.environ['FLASK_ENV'] = 'production'
    
    # Get port from environment or default to 5000
    port = int(os.getenv('PORT', 5000))
    
    print(f"Starting backend server on port {port}")
    print(f"Environment: {os.getenv('FLASK_ENV', 'development')}")
    
    # Run the app
    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    )

if __name__ == '__main__':
    main()
