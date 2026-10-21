// npm run check:aws: proves Bedrock and DynamoDB answer with the settings in .env, before you record.
import { DescribeTableCommand, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { bedrockModel, converse, replyText } from '../src/bedrock.js';
import { storeFromEnv } from '../src/store.js';
import { initialState } from '../src/seed.js';

let failed = false;
const ok = (m: string) => console.log(`  OK    ${m}`);
const bad = (m: string) => {
  failed = true;
  console.log(`  FAIL  ${m}`);
};

console.log(`Region: ${process.env.AWS_REGION ?? '(not set: the SDK default)'}`);

const model = bedrockModel();
if (!model) bad('BEDROCK_MODEL_ID is not set, so answers come from templates.');
else {
  try {
    const started = Date.now();
    const out = await converse({ messages: [{ role: 'user', content: [{ text: 'Reply with the single word: ready' }] }] }, { maxTokens: 400, temperature: 0 });
    const text = replyText(out);
    if (text) ok(`Bedrock ${model} answered "${text.slice(0, 40)}" in ${Date.now() - started} ms`);
    else bad(`Bedrock ${model} answered with no text (stop reason: ${out.stopReason}). Try a larger max token budget or another model.`);
  } catch (err) {
    bad(`Bedrock ${model}: ${(err as Error).name}: ${(err as Error).message}`);
  }
}

const table = process.env.PAWZOO_TABLE;
if (!table) bad('PAWZOO_TABLE is not set, so state goes to a local file.');
else {
  try {
    const d = await new DynamoDBClient(process.env.AWS_REGION ? { region: process.env.AWS_REGION } : {}).send(new DescribeTableCommand({ TableName: table }));
    const key = d.Table?.KeySchema?.map((k) => `${k.AttributeName} (${k.KeyType})`).join(', ');
    if (!d.Table?.KeySchema?.some((k) => k.AttributeName === 'householdId' && k.KeyType === 'HASH')) bad(`DynamoDB ${table}: partition key must be householdId (string); found ${key}`);
    else {
      const store = storeFromEnv();
      const existing = await store.load('hh-rivera');
      if (!existing) await store.save(initialState(new Date().toISOString().slice(0, 10)));
      ok(`DynamoDB ${table} (${d.Table.TableStatus}), key ${key}, read${existing ? '' : ' and seeded'} the demo household`);
    }
  } catch (err) {
    bad(`DynamoDB ${table}: ${(err as Error).name}: ${(err as Error).message}`);
  }
}

process.exit(failed ? 1 : 0);
