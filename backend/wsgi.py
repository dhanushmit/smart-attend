"""
Gunicorn entrypoint.
Render/production should run: gunicorn wsgi:app
"""

from app import app

