const fs = require('fs');
const readline = require('readline');

async function extractStep5514Raw() {
    const fileStream = fs.createReadStream('C:/Users/skbap/.gemini/antigravity/brain/cdf43c04-d870-43ef-8610-727ff08ec79d/.system_generated/logs/transcript.jsonl');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (line.includes('"step_index":5514')) {
            fs.writeFileSync('scratch/step5514.json', line);
            console.log('Saved to scratch/step5514.json');
            break;
        }
    }
}
extractStep5514Raw();
