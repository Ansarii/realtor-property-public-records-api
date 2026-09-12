import { ApifyClient } from 'apify-client';

// 1. Initialize client
const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

const input = {'url': 'https://www.realtor.com/realestateandhomes-detail/123-Main-St_Austin_TX_78701_M12345-67890', 'mode': 'realtor'};

(async () => {
    console.log('Starting Actor neon_innovation_lab/realestate-intel-mcp on Apify Cloud...');
    const run = await client.actor('neon_innovation_lab/realestate-intel-mcp').call(input);
    
    console.log();
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    console.dir(items, { depth: null });
})();
