import os
import json
import logging
from typing import Any, Dict, List

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.getenv("TABLE_NAME", "")
BUCKET_NAME = os.getenv("BUCKET_NAME", "")

def handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Minimal Lambda handler.

    - If invoked by SQS (Records present), acknowledge everything as success
      using the Partial Batch Response format.
    - If invoked directly (e.g., test event), just return {"status": "ok"}.
    """
    logger.info("event=%s", json.dumps(event))

    if isinstance(event, dict) and "Records" in event:
        # SQS event: acknowledge all messages as processed
        return {"batchItemFailures": []}

    return {"status": "ok"}
