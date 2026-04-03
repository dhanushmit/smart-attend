import cv2
import numpy as np
import base64
import os


# Face engine selection:
# - "opencv" (default): YuNet face detector + SFace recognizer (ONNX) via OpenCV.
# - "deepface": DeepFace ArcFace pipeline (heavy, not suitable for Render free).
_FACE_ENGINE = (os.environ.get("FACE_ENGINE") or "").strip().lower()


def _is_render_env():
    return bool(os.environ.get("RENDER")) or bool(os.environ.get("RENDER_SERVICE_ID")) or bool(os.environ.get("RENDER_EXTERNAL_URL"))


def _default_engine():
    if _FACE_ENGINE in ("opencv", "deepface"):
        return _FACE_ENGINE
    # Prefer the lightweight engine on Render (memory constrained).
    if _is_render_env():
        return "opencv"
    return "opencv"


_ENGINE = _default_engine()
_OPENCV_MODELS = None


def get_engine_name():
    return _ENGINE


def _decode_image(img_source):
    if isinstance(img_source, str):
        if os.path.exists(img_source):
            return cv2.imread(img_source)
        if img_source.startswith('data:image') or ',' in img_source:
            if ',' in img_source:
                img_source = img_source.split(',')[1]
            img_data = base64.b64decode(img_source)
            nparr = np.frombuffer(img_data, np.uint8)
            return cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return None

    if isinstance(img_source, bytes):
        nparr = np.frombuffer(img_source, np.uint8)
        return cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    return img_source


def _get_opencv_models():
    global _OPENCV_MODELS
    if _OPENCV_MODELS is not None:
        return _OPENCV_MODELS

    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "ai_models")
    yunet_path = os.path.abspath(os.path.join(models_dir, "face_detection_yunet.onnx"))
    sface_path = os.path.abspath(os.path.join(models_dir, "face_recognition_sface.onnx"))

    if not os.path.exists(yunet_path):
        raise FileNotFoundError(f"Missing YuNet model: {yunet_path}")
    if not os.path.exists(sface_path):
        raise FileNotFoundError(f"Missing SFace model: {sface_path}")

    # The detector input size must be set before detection. We'll update per-image.
    detector = cv2.FaceDetectorYN.create(yunet_path, "", (320, 320))
    recognizer = cv2.FaceRecognizerSF.create(sface_path, "")

    _OPENCV_MODELS = (detector, recognizer)
    return _OPENCV_MODELS


def _pick_primary_face(face_results):
    if not face_results:
        return None

    def score(face):
        area = face.get("facial_area", {}) or {}
        width = max(int(area.get("w", 0)), 0)
        height = max(int(area.get("h", 0)), 0)
        confidence = float(face.get("confidence", 0) or 0)
        return (width * height) * max(confidence, 0.5)

    return max(face_results, key=score)


def _crop_face_from_area(img, facial_area, target_size=(512, 512), margin_ratio=0.35):
    h, w = img.shape[:2]
    x = int(facial_area.get("x", 0))
    y = int(facial_area.get("y", 0))
    fw = int(facial_area.get("w", 0))
    fh = int(facial_area.get("h", 0))

    if fw <= 0 or fh <= 0:
        return None

    mx = int(fw * margin_ratio)
    my = int(fh * margin_ratio)

    x1 = max(0, x - mx)
    y1 = max(0, y - my)
    x2 = min(w, x + fw + mx)
    y2 = min(h, y + fh + my)

    cropped = img[y1:y2, x1:x2]
    if cropped.size == 0:
        return None

    return cv2.resize(cropped, target_size, interpolation=cv2.INTER_CUBIC)


def analyze_face(img_source, target_size=(512, 512)):
    """Return embedding, cropped face bytes, and a simple quality score."""
    try:
        img = _decode_image(img_source)
        if img is None:
            return None

        if _ENGINE == "deepface":
            # Lazy import: DeepFace/TensorFlow are heavy and may not exist in production.
            from deepface import DeepFace  # type: ignore

            faces = DeepFace.extract_faces(
                img_path=img,
                detector_backend="retinaface",
                align=False,
                enforce_detection=True
            )
            primary_face = _pick_primary_face(faces)
            if not primary_face:
                return None

            cropped = _crop_face_from_area(img, primary_face.get("facial_area", {}), target_size=target_size)
            if cropped is None:
                return None

            represent_res = DeepFace.represent(
                img_path=cropped,
                model_name="ArcFace",
                detector_backend="skip",
                align=True,
                enforce_detection=False
            )
            if not represent_res:
                return None

            rep = represent_res[0] if isinstance(represent_res, list) else represent_res
            emb = np.array(rep["embedding"], dtype=np.float32)
            emb_norm = np.linalg.norm(emb)
            if emb_norm == 0:
                return None
            emb = emb / emb_norm
            facial_area = (primary_face.get("facial_area", {}) or {})
        else:
            detector, recognizer = _get_opencv_models()

            h, w = img.shape[:2]
            detector.setInputSize((w, h))
            _, faces = detector.detect(img)
            if faces is None or len(faces) == 0:
                return None

            # faces: Nx15 -> [x,y,w,h,score, l0x,l0y,...]
            faces = faces.astype(np.float32)
            # pick largest face area
            areas = faces[:, 2] * faces[:, 3]
            idx = int(np.argmax(areas))
            face = faces[idx]

            # Align & crop using SFace helper.
            aligned = recognizer.alignCrop(img, face)
            if aligned is None or aligned.size == 0:
                return None

            # Feature extraction
            feat = recognizer.feature(aligned)
            if feat is None:
                return None
            emb = np.array(feat, dtype=np.float32).flatten()
            emb_norm = np.linalg.norm(emb)
            if emb_norm == 0:
                return None
            emb = emb / emb_norm

            cropped = cv2.resize(aligned, target_size, interpolation=cv2.INTER_CUBIC)
            facial_area = {"x": float(face[0]), "y": float(face[1]), "w": float(face[2]), "h": float(face[3])}

        gray = cv2.cvtColor(cropped, cv2.COLOR_BGR2GRAY)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        area = cropped.shape[0] * cropped.shape[1]
        quality = round((area / 1000.0) + sharpness, 2)

        ok, buffer = cv2.imencode('.jpg', cropped, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        if not ok:
            return None

        return {
            "embedding": emb.tolist(),
            "face_bytes": buffer.tobytes(),
            "quality": quality,
            "facial_area": facial_area
        }
    except Exception as e:
        print(f"Face Analysis Error: {e}")
        return None


def get_face_embedding(img_source):
    """
    Extract embedding vector from an image source.
    Uses ArcFace + RetinaFace and returns L2-normalized embedding.
    """
    try:
        result = analyze_face(img_source)
        if not result:
            return None, False
        return result["embedding"], True
    except Exception as e:
        print(f"Embedding Error: {e}")
        return None, False


def embedding_distance(emb1, emb2):
    """Return L2 distance between two L2-normalized embeddings (engine-agnostic)."""
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


def embedding_cosine(emb1, emb2):
    """Return cosine similarity between two L2-normalized embeddings."""
    try:
        a = np.array(emb1, dtype=np.float32)
        b = np.array(emb2, dtype=np.float32)
        a_norm = np.linalg.norm(a)
        b_norm = np.linalg.norm(b)
        if a_norm == 0 or b_norm == 0:
            return None
        a = a / a_norm
        b = b / b_norm
        return float(np.dot(a, b))
    except Exception:
        return None


def crop_and_zoom_face(image_source, target_size=(512, 512)):
    try:
        result = analyze_face(image_source, target_size=target_size)
        if not result:
            return None, False
        return result["face_bytes"], True

    except Exception as e:
        print(f"Face Zoom Error: {e}")
        return None, False
