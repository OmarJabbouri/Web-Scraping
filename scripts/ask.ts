/**
 * Ask the RAG system a question and see the whole process (Phase 5.3 → 5.5).
 *
 *   npx tsx scripts/ask.ts "What did Einstein say about imagination?"
 *
 * Prints: the retrieved source chunks (hybrid search) → then the grounded, cited answer that
 * gpt-4o-mini writes using ONLY those chunks.
 */
import { hybridSearch, generateAnswer } from '@rag/rag';
import { sequelize } from '@rag/db';
import { closeQueues } from '@rag/shared';

async function main(): Promise<void> {
  const question = process.argv.slice(2).join(' ') || 'What did Einstein say about imagination?';
  console.log(`\nQUESTION: ${question}\n`);

  // 1) RETRIEVE — find the most relevant chunks across everything we've indexed.
  console.log('--- Step 1: retrieved sources (hybrid search) ---');
  const chunks = await hybridSearch(question, 5);
  chunks.forEach((c, i) => {
    console.log(`[${i + 1}] score=${c.score.toFixed(3)}  ${c.url}`);
    console.log(`    ${c.text.replace(/\s+/g, ' ').slice(0, 160)}…`);
  });

  // 2) GENERATE — hand those chunks to gpt-4o-mini and require citations.
  console.log('\n--- Step 2: grounded answer (gpt-4o-mini) ---');
  const ans = await generateAnswer(question, chunks);
  console.log(`\n${ans.answer}\n`);
  console.log('CITATIONS:');
  ans.citations.forEach((c) => console.log(`  [${c.marker}] ${c.url}`));

  await closeQueues();
  await sequelize.close();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
