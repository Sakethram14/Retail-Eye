import cv2
import numpy as np

def is_horizontal(line, tolerance=0.1):
    """Checks if a line is nearly horizontal."""
    x1, y1, x2, y2 = line[0]
    if x2 == x1:
        return False
    slope = abs((y2 - y1) / (x2 - x1))
    return slope < tolerance

def detect_shelf_levels(img_blur):
    """
    Step 2: Shelf level detection via Hough Line Transform
    Robust to perspective distortion and partial occlusion.
    """
    # Canny Edge Detection
    edges = cv2.Canny(img_blur, 50, 150)
    
    # Hough Line Transform (Probabilistic)
    lines = cv2.HoughLinesP(
        edges,
        rho=1,
        theta=np.pi/180,
        threshold=80,
        minLineLength=200,
        maxLineGap=30
    )
    
    if lines is None:
        return []
        
    # Filter to near-horizontal lines only
    shelf_lines = [l for l in lines if is_horizontal(l)]
    
    # Sort shelf lines by Y coordinate
    shelf_lines.sort(key=lambda l: (l[0][1] + l[0][3]) / 2)
    
    return shelf_lines
