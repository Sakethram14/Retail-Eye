from .preprocessor import preprocess_image, perspective_correction
from .shelf_detector import detect_shelf_levels
from .gap_detector import segment_shelf_regions, detect_gaps
from .sku_matcher import identify_skus
from .annotator import annotate_shelf

def process_shelf_image(image_bgr, planogram_db):
    """
    Orchestrates the entire CV pipeline from Section 4.
    """
    # Step 1: Preprocess
    img_resized, img_blur = preprocess_image(image_bgr)
    
    # Step 2: Detect shelf levels
    shelf_lines = detect_shelf_levels(img_blur)
    
    # Step 3: Perspective correction
    img_warped = perspective_correction(img_resized, shelf_lines)
    
    # Step 4: Segmentation
    shelf_strips = segment_shelf_regions(img_warped, shelf_lines)
    
    # Step 5: Gap detection
    gaps = detect_gaps(shelf_strips)
    
    # Step 6: SKU identification
    gaps_with_sku = identify_skus(img_warped, gaps, planogram_db)
    
    # Step 7: Annotation
    annotated_frame = annotate_shelf(img_warped, gaps_with_sku)
    
    return {
        'gaps': gaps_with_sku,
        'annotated_frame': annotated_frame,
        'shelf_count': len(shelf_lines)
    }
