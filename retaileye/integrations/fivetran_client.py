import json
import os

# Simulated BigQuery/Fivetran client
class FivetranClient:
    def __init__(self, db_path="database/mock_inventory.json"):
        self.db_path = db_path
        self._load_db()

    def _load_db(self):
        try:
            with open(self.db_path, "r") as f:
                self.data = json.load(f)
        except FileNotFoundError:
            self.data = {"stores": []}

    def query_inventory(self, sku_id, store_id, location):
        """
        Simulates querying Fivetran-synced BigQuery.
        """
        store = next((s for s in self.data['stores'] if s['id'] == store_id), None)
        if not store:
            return None
            
        item = next((i for i in store['inventory'] if i['sku_id'] == sku_id), None)
        if not item:
            return None
            
        if location == 'backroom':
            qty = item['backroom_stock']
        elif location == 'warehouse':
            qty = item['warehouse_stock']
        else: # supplier
            qty = 1000 # Assume supplier always has stock for demo unless specified
            
        return {
            "sku_id": sku_id,
            "location": location,
            "quantity_available": qty,
            "days_of_supply": qty / max(1, item['velocity']),
            "velocity_units_per_day": item['velocity'],
            "supplier_id": item['supplier_id'],
            "product_name": item['product_name']
        }
