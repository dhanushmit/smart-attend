import cv2
import numpy as np
import base64
from deepface import DeepFace


def _decode_image(img_source):
    if isinstance(img_source, str):
        if ',' in img_source:
            img_source = img_source.split(',')[1]
        img_data = base64.b64decode(img_source)
        nparr = np.frombuffer(img_data, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if isinstance(img_source, bytes):
        nparr = np.frombuffer(img_source, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    return img_source


def get_face_embedding(img_source):
    """
    Extract embedding vector from an image source.
    Uses ArcFace + RetinaFace and returns L2-normalized embedding.
    """
    try:
        img = _decode_image(img_source)
        if img is None:
            return None, False

        # Soft eye heuristic only; do not reject hard as this is noisy.
        try:
            eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            eyes = eye_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=3, minSize=(10, 10))
            if len(eyes) == 0:
                print("Eye check warning: no eyes detected. Continuing with face model.")
        except Exception as e:
            print("Eye check skipped due to error:", e)

        res = DeepFace.represent(
            img_path=img,
            model_name="ArcFace",
            detector_backend="retinaface",
            align=True,
            enforce_detection=True
        )

        if res and len(res) > 0:
            largest_face = max(res, key=lambda x: x["facial_area"]["w"] * x["facial_area"]["h"])
            emb = np.array(largest_face["embedding"], dtype=np.float32)
            emb_norm = np.linalg.norm(emb)
            if emb_norm == 0:
                return None, False
            emb = emb / emb_norm
            return emb.tolist(), True

        return None, False
    except Exception as e:
        print(f"Embedding Error: {e}")
        return None, False


def embedding_distance(emb1, emb2):
    """Return normalized ArcFace L2 distance between two embeddings."""
    try:
        a = np.array(emb1, dtype=np.float32)
        b = np.array(emb2, dtype=np.float32)
        a_norm = np.linalg.norm(a)
        b_norm = np.linalg.norm(b)
        if a_norm == 0 or b_norm == 0:
            return None
        a = a / a_norm
        b = b / b_norm
        return float(np.linalg.norm(a - b))
    except Exception:
        return None


def crop_and_zoom_face(image_source, target_size=(512, 512)):
    try:
        img = _decode_image(image_source)
        if img is None:
            return None, False

        faces = DeepFace.extract_faces(
            img_path=img,
            target_size=target_size,
            detector_backend="retinaface",
            align=True,
            enforce_detection=True
        )

        if len(faces) > 0:
            face_img = faces[0]["face"]

            if face_img.max() <= 1:
                face_img = face_img * 255

            face_img = face_img.astype(np.uint8)
            face_img = cv2.cvtColor(face_img, cv2.COLOR_RGB2BGR)

            _, buffer = cv2.imencode('.jpg', face_img)
            return buffer.tobytes(), True

        return None, False

    except Exception as e:
        print(f"Face Zoom Error: {e}")
        return None, False
