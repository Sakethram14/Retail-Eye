import cv2
import numpy as np

GSD_CM_PER_PIXEL = 0.1 # Example: 1 pixel = 1mm (0.1cm)

def segment_shelf_regions(img_warped, shelf_lines):
    """
    Step 4: Per-shelf-region segmentation
    Divide warped image into shelf strips using horizontal lines.
    """
    shelf_strips = []
    
    # Get Y coordinates of unique shelf lines
    y_coords = sorted(list(set([(l[0][1] + l[0][3]) // 2 for l in shelf_lines])))
    
    for i in range(len(y_coords) - 1):
        y_top = y_coords[i]
        y_bottom = y_coords[i+1]
        
        # Buffer the Y coordinates to capture the shelf content
        strip = img_warped[max(0, y_top-100):min(720, y_bottom), 0:1280]
        shelf_strips.append({
            'strip': strip, 
            'shelf_level': i,
            'y_offset': max(0, y_top-100)
        })
        
    return shelf_strips

def detect_gaps(shelf_strips):
    """
    Step 5: Gap detection per shelf strip
    Uses Otsu thresholding to find dark gaps between bright product faces.
    """
    all_gaps = []
    
    for strip_info in shelf_strips:
        strip = strip_info['strip']
        gray_strip = cv2.cvtColor(strip, cv2.COLOR_BGR2GRAY)
        
        # Otsu's thresholding
        _, thresh = cv2.threshold(
            gray_strip, 0, 255, 
            cv2.THRESH_BINARY + cv2.THRESH_OTSU
        )
        
        # Invert to make products white and gaps black (or vice versa)
        # Assuming product faces are brighter than gap background
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Sort contours left to right
        contours = sorted(contours, key=lambda c: cv2.boundingRect(c)[0])
        
        strip_gaps = []
        for i in range(len(contours) - 1):
            x1, y1, w1, h1 = cv2.boundingRect(contours[i])
            x2, y2, w2, h2 = cv2.boundingRect(contours[i+1])
            
            gap_start = x1 + w1
            gap_end = x2
            gap_width_px = gap_end - gap_start
            
            # Filter noise (small gaps)
            if gap_width_px > 20: 
                gap_center_x = (gap_start + gap_end) / 2
                strip_gaps.append({
                    'shelf_level': strip_info['shelf_level'],
                    'x_start': gap_start,
                    'x_end': gap_end,
                    'width_px': gap_width_px,
                    'width_cm': gap_width_px * GSD_CM_PER_PIXEL,
                    'x_position_cm': gap_center_x * GSD_CM_PER_PIXEL,
                    'y_offset': strip_info['y_offset']
                })
        
        all_gaps.extend(strip_gaps)
        
    return all_gaps
