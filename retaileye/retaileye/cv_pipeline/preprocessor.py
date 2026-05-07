import cv2
import numpy as np

def preprocess_image(image_bgr):
    """
    Step 1: Resize and color normalize
    Reduces sensor noise without destroying shelf edge structure.
    """
    # Resize for consistent processing
    img_resized = cv2.resize(image_bgr, (1280, 720))
    
    # Gray scale conversion
    img_gray = cv2.cvtColor(img_resized, cv2.COLOR_BGR2GRAY)
    
    # Gaussian Blur (3x3 kernel) to reduce noise
    img_blur = cv2.GaussianBlur(img_gray, (3, 3), 0)
    
    return img_resized, img_blur

def perspective_correction(image_resized, shelf_lines):
    """
    Step 3: Perspective correction (deskew)
    Maps pixel distances linearly to shelf centimeter distances.
    """
    if not shelf_lines:
        return image_resized
        
    # Detect shelf corners from outermost shelf lines
    # Simplified logic for finding the 4 corners of the shelf bounding box
    all_points = []
    for line in shelf_lines:
        x1, y1, x2, y2 = line[0]
        all_points.append([x1, y1])
        all_points.append([x2, y2])
    
    all_points = np.array(all_points)
    
    # Find bounding box corners
    x_min, y_min = np.min(all_points, axis=0)
    x_max, y_max = np.max(all_points, axis=0)
    
    src_points = np.float32([
        [x_min, y_min], [x_max, y_min], 
        [x_max, y_max], [x_min, y_max]
    ])
    
    dst_points = np.float32([
        [0, 0], [1280, 0], 
        [1280, 720], [0, 720]
    ])
    
    M = cv2.getPerspectiveTransform(src_points, dst_points)
    img_warped = cv2.warpPerspective(image_resized, M, (1280, 720))
    
    return img_warped
