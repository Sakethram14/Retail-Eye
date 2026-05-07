import cv2
import numpy as np

def annotate_shelf(image, gaps):
    """
    Draws bounding boxes and labels for detected gaps.
    """
    output = image.copy()
    for gap in gaps:
        x_start = int(gap['x_start'])
        x_end = int(gap['x_end'])
        y_center = int(gap['y_offset'] + 150)
        
        # Draw red rectangle for gap
        cv2.rectangle(output, (x_start, y_center-50), (x_end, y_center+50), (0, 0, 255), 3)
        
        # Label with expected SKU and confidence
        label = f"Gap: {gap['expected_sku']} ({gap['confidence']:.2f})"
        cv2.putText(output, label, (x_start, y_center-70), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
        
    return output
