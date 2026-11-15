"""Shared configuration for the DELTA PULSE data pipeline.

Study areas are defined here once so every script (discovery, inspection,
processing) uses exactly the same geometry.
"""
from pathlib import Path

from system_certs import use_system_certificates

use_system_certificates()  # Windows: trust the same HTTPS roots as the OS (antivirus HTTPS scanning)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
PROCESSED = DATA / "processed"
METADATA = DATA / "metadata"
# The web app reads its data from here (copied by scripts/processing/export_web.py)
WEB_DATA = ROOT / "public" / "data"

# Areas of interest as (min_lon, min_lat, max_lon, max_lat), WGS84.
# Boxes are deliberately simple so they are easy to audit and reproduce.
STUDY_AREAS = {
    "tonle_sap": {
        "name": "Tonle Sap Lake, Cambodia",
        # Lake plus the seasonally flooded forest/shrub belt around it.
        "bbox": (103.55, 12.35, 104.55, 13.35),
    },
    "barataria": {
        "name": "Barataria Bay, Louisiana, USA",
        # Barataria Bay and the surrounding marsh of the lower Barataria basin.
        "bbox": (-90.25, 29.20, -89.75, 29.70),
    },
}

# ASF collection name -> maturity label. Anything not listed is reported as-is
# and treated as "OTHER" (never silently merged with validated data).
COLLECTION_MATURITY = {
    "NISAR_L2_GCOV_V1": "VALIDATED",
    "NISAR_L2_GCOV_PROVISIONAL_V1": "PROVISIONAL",
    "NISAR_L2_GCOV_BETA_V1": "BETA",
}


def bbox_wkt(bbox):
    x0, y0, x1, y1 = bbox
    return f"POLYGON(({x0} {y0},{x1} {y0},{x1} {y1},{x0} {y1},{x0} {y0}))"
