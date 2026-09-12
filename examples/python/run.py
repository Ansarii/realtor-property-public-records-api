import os
from apify_client import ApifyClient

# 1. Initialize ApifyClient (pass your API token or set APIFY_TOKEN env var)
client = ApifyClient(os.getenv("APIFY_TOKEN"))

# 2. Configure input
run_input = {'url': 'https://www.realtor.com/realestateandhomes-detail/123-Main-St_Austin_TX_78701_M12345-67890', 'mode': 'realtor'}

# 3. Call Actor on Apify Cloud
print("Starting Actor neon_innovation_lab/realestate-intel-mcp on Apify Cloud...")
run = client.actor("neon_innovation_lab/realestate-intel-mcp").call(run_input=run_input)

# 4. Stream results from default dataset
print(f"Run finished with status: {run['status']}. Fetching results...")
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    print(item)
