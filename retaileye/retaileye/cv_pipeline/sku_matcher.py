import cv2
import numpy as np

def compute_match_score(matches):
    """Computes a confidence score based on ORB matches."""
    if not matches:
        return 0.0
    mean_dist = np.mean([m.distance for m in matches])
    return max(0.0, 1.0 - (mean_dist / 64.0)) # Hamming distance normalization

def identify_skus(img_warped, gaps, planogram_db):
    """
    Step 6: SKU identification via ORB keypoint matching
    Patnent-free, fast, and rotation/scale invariant.
    """
    orb = cv2.ORB_create(nfeatures=500)
    bf_matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    
    for gap in gaps:
        # Extract the region just to the left of the gap (neighbor SKU)
        # ROI: x_start - 150px to x_start
        roi_x_start = max(0, gap['x_start'] - 200)
        roi_x_end = gap['x_start']
        
        # Use y-coordinate context from the strip
        roi_y_start = max(0, gap['y_offset'])
        roi_y_end = min(720, gap['y_offset'] + 300)
        
        neighbor_roi = img_warped[roi_y_start:roi_y_end, roi_x_start:roi_x_end]
        
        if neighbor_roi.size == 0:
            gap['expected_sku'] = "UNKNOWN"
            gap['confidence'] = 0.0
            continue
            
        kp1, des1 = orb.detectAndCompute(neighbor_roi, None)
        
        if des1 is None:
            gap['expected_sku'] = "UNKNOWN"
            gap['confidence'] = 0.0
            continue
            
        best_match = "UNKNOWN"
        best_score = 0.0
        
        for sku_id, ref_data in planogram_db.items():
            # In a real system, ref_data would be pre-computed descriptors
            # For this module, we assume it has 'descriptors'
            if 'descriptors' not in ref_data: continue
            
            des2 = ref_data['descriptors']
            if des2 is None: continue
            
            matches = bf_matcher.match(des1, des2)
            matches = sorted(matches, key=lambda x: x.distance)
            
            score = compute_match_score(matches[:20])
            if score > best_score:
                best_score = score
                best_match = sku_id
                
        gap['expected_sku'] = best_match
        gap['confidence'] = best_score
        
    return gaps
