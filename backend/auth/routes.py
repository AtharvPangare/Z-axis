from flask import Blueprint, request, jsonify
from .models import users_collection
from .utils import hash_password, check_password, generate_jwt, decode_jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os
import uuid
import re

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', 'placeholder-id')

@auth_bp.route('/config', methods=['GET'])
def get_config():
    return jsonify({
        "google_client_id": GOOGLE_CLIENT_ID
    })

def is_valid_email(email):
    return re.match(r"^[\w\.\+\-]+\@[\w]+\.[a-z]{2,3}$", email)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email', '').lower()
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
        
    if not is_valid_email(email):
        return jsonify({"error": "Invalid email format"}), 400
        
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Email already exists"}), 400

    hashed_pw = hash_password(password)
    user_id = str(uuid.uuid4())
    
    new_user = {
        "_id": user_id,
        "email": email,
        "password": hashed_pw,
        "provider": "local"
    }
    
    users_collection.insert_one(new_user)
    
    token = generate_jwt(user_id)
    
    response = jsonify({"message": "User created successfully"})
    # Drop HTTP-Only cookie to prevent XSS sniffing
    response.set_cookie('access_token', token, httponly=True, samesite='Lax', max_age=24*3600)
    return response

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email', '').lower()
    password = data.get('password')

    user = users_collection.find_one({"email": email, "provider": "local"})
    
    if not user or not check_password(password, user['password']):
        return jsonify({"error": "Invalid credentials"}), 401

    token = generate_jwt(user["_id"])
    
    response = jsonify({"message": "Login successful"})
    response.set_cookie('access_token', token, httponly=True, samesite='Lax', max_age=24*3600)
    return response

@auth_bp.route('/google', methods=['POST'])
def google_auth():
    data = request.json
    token = data.get('idToken')
    
    if not token:
        return jsonify({"error": "Missing Google Token"}), 400

    try:
        # Verify Token securely with Google's public keys
        idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email'].lower()
        
        user = users_collection.find_one({"email": email})
        
        if not user:
            # First-time Google user - automatically provision new account
            user_id = str(uuid.uuid4())
            user = {
                "_id": user_id,
                "email": email,
                "provider": "google",
                "name": idinfo.get('name', ''),
                "picture": idinfo.get('picture', '')
            }
            users_collection.insert_one(user)
            
        jwt_token = generate_jwt(user["_id"])
        
        response = jsonify({"message": "Google Login successful"})
        response.set_cookie('access_token', jwt_token, httponly=True, samesite='Lax', max_age=24*3600)
        return response
        
    except ValueError as e:
        return jsonify({"error": "Invalid Google token"}), 401

@auth_bp.route('/logout', methods=['POST'])
def logout():
    response = jsonify({"message": "Logged out"})
    # Expire cookie instantly
    response.set_cookie('access_token', '', httponly=True, expires=0)
    return response

@auth_bp.route('/me', methods=['GET'])
def get_me():
    token = request.cookies.get('access_token')
    if not token:
        return jsonify({"error": "Unauthorized"}), 401
        
    decoded = decode_jwt(token)
    if not decoded:
        return jsonify({"error": "Unauthorized"}), 401
        
    user = users_collection.find_one({"_id": decoded["user_id"]}, {"password": 0})
    if not user:
        return jsonify({"error": "User not found"}), 404
        
    return jsonify({"user": user})

def require_auth(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get('access_token')
        if not token:
            return jsonify({"error": "Authentication required. Please log in."}), 401
        
        payload = decode_jwt(token)
        if not payload:
            return jsonify({"error": "Invalid or expired token."}), 401
            
        user = users_collection.find_one({"_id": payload["user_id"]})
        if not user:
            return jsonify({"error": "User not found"}), 401
            
        # Optional: attach user to request object
        # request.user = user
        return f(*args, **kwargs)
    return decorated
